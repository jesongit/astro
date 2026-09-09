/**
 * Worker 调度逻辑测试(Node 环境):
 * 用 Map 模拟 PortfolioKV + 注入 fetch stub,覆盖计划 §17 的关键状态机:
 * CONTROL 写隔离 / 私有→墓碑 / 坏配置保 LKG / Release 独立更新与删除 /
 * 限流不清资格不续期 / 401 抛凭据错误 / 手动任务消费 / 过期任务 /
 * 观察不可变 key。
 *
 * workerd 真实 KV API 形状由 tests/worker/smoke.test.ts(池化)单独覆盖。
 */
import { describe, expect, it, vi } from "vitest";
import { handleTick } from "../../workers/portfolio-sync/src/scheduler";
import {
  ControlStore,
  JobsStore,
  PublicCacheStore,
  SyncWriteStore,
  type PortfolioKV,
} from "../../src/lib/portfolio/store";
import { evaluatePublication } from "../../src/lib/portfolio/publication";
import type { SyncJob } from "../../src/lib/portfolio/types";

/* ── Map 版 PortfolioKV:语义与 Cloudflare KV 对齐,故意小分页强制走 cursor ── */
class MemoryKV implements PortfolioKV {
  private store = new Map<string, string>();
  readonly putKeys: string[] = [];

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async put(key: string, value: string): Promise<void> {
    this.putKeys.push(key);
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
  async list(options: { prefix: string; cursor?: string; limit?: number }) {
    const names = [...this.store.keys()]
      .filter(k => k.startsWith(options.prefix))
      .sort();
    const start = options.cursor ? Number(options.cursor) : 0;
    const limit = options.limit ?? 2;
    const keys = names.slice(start, start + limit).map(name => ({ name }));
    const list_complete = start + limit >= names.length;
    return {
      keys,
      list_complete,
      cursor: list_complete ? undefined : String(start + limit),
    };
  }
}

interface Route {
  match: (url: string) => boolean;
  reply: (url: string) => {
    status: number;
    json?: unknown;
    headers?: Record<string, string>;
  };
}

function makeTestEnv(routes: Route[], syncEnabled = "true") {
  const controlKV = new MemoryKV();
  const cacheKV = new MemoryKV();
  const jobsKV = new MemoryKV();
  const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
    void init;
    // 默认候选池路由:空列表,立即完成(个别测试可插更早匹配的路由覆盖)
    if (String(url).startsWith("https://api.github.com/users/jesongit/repos")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    const route = routes.find(r => r.match(String(url)));
    if (!route) throw new Error(`unexpected upstream request: ${String(url)}`);
    const res = route.reply(String(url));
    return new Response(
      res.json === undefined ? null : JSON.stringify(res.json),
      { status: res.status, headers: new Headers(res.headers) }
    );
  });
  const env = {
    PORTFOLIO_CONTROL: controlKV as unknown as KVNamespace,
    PORTFOLIO_CACHE: cacheKV as unknown as KVNamespace,
    PORTFOLIO_JOBS: jobsKV as unknown as KVNamespace,
    GITHUB_TOKEN: "test-token",
    GITHUB_OWNER: "jesongit",
    GITHUB_OWNER_TYPE: "user",
    GITHUB_API_VERSION: "2026-03-10",
    SYNC_ENABLED: syncEnabled,
  };
  return {
    env,
    control: new ControlStore(controlKV),
    controlKV,
    cacheKV,
    jobsKV,
    publicCache: new PublicCacheStore(cacheKV),
    jobs: new JobsStore(jobsKV),
    fetchImpl,
  };
}

const REPO_PREFIX = "https://api.github.com/repos/jesongit/aurora-theme";

const repoJson = {
  id: 1001,
  node_id: "node-1",
  name: "aurora-theme",
  full_name: "jesongit/aurora-theme",
  private: false,
  description: "主题描述",
  default_branch: "main",
  topics: ["astro"],
  language: "TypeScript",
  stargazers_count: 7,
  license: { spdx_id: "MIT" },
  homepage: "",
  archived: false,
  owner: { login: "jesongit" },
};

/** 标准仓库路由:可注入 sha/README/配置/Release 行为 */
function repoRoutes(behavior: {
  repo?: unknown;
  sha?: string;
  readme?: { status: number } | null;
  config?: { status: number; body: string } | null;
  release?: { status: number; body: Record<string, unknown> } | null;
}): Route {
  return {
    match: url => url.startsWith(REPO_PREFIX),
    reply: url => {
      if (url.endsWith("/commits/main"))
        return { status: 200, json: { sha: behavior.sha ?? "sha-1" } };
      if (url.includes("/readme"))
        return behavior.readme === null
          ? { status: 404, json: { message: "Not Found" } }
          : {
              status: 200,
              json: {
                content: Buffer.from("# Aurora\n\n主题说明", "utf8").toString(
                  "base64"
                ),
                encoding: "base64",
                size: 20,
              },
            };
      if (url.includes("/contents/.portfolio/portfolio.json"))
        return behavior.config
          ? {
              status: behavior.config.status,
              json: {
                content: Buffer.from(behavior.config.body, "utf8").toString(
                  "base64"
                ),
                encoding: "base64",
                size: behavior.config.body.length,
              },
            }
          : { status: 404, json: { message: "Not Found" } };
      if (url.endsWith("/releases/latest"))
        return behavior.release
          ? { status: behavior.release.status, json: behavior.release.body }
          : { status: 404, json: { message: "Not Found" } };
      return {
        status: 200,
        json: behavior.repo ?? repoJson,
      };
    },
  };
}

const settingsInput = {
  schemaVersion: 1,
  repoId: "1001",
  visible: true,
  featured: false,
  order: 100,
  acknowledgedIncidentId: null,
  updatedBy: "admin@example.com",
} as const;

const NOW = Date.parse("2026-09-09T12:00:00Z");

/** 预置完整候选清单:ID→名称解析的数据来源(生产由 6h 枚举生成) */
async function seedInventory(cacheKV: MemoryKV): Promise<void> {
  const cache = new SyncWriteStore(cacheKV);
  await cache.putInventory({
    schemaVersion: 1,
    runId: "seed",
    completed: true,
    observedAt: new Date(NOW).toISOString(),
    repos: [
      { repoId: "1001", fullName: "jesongit/aurora-theme", nodeId: "node-1" },
    ],
  });
}

describe("handleTick 调度逻辑(计划 §8.2/§8.3/§17)", () => {
  it("SYNC_ENABLED=false 不发上游请求", async () => {
    const { env, fetchImpl } = makeTestEnv([], "false");
    const result = await handleTick(env, NOW, { fetchImpl });
    expect(result.disabled).toBe(true);
    expect(result.processed).toBe(0);
  });

  it("基础同步全链:观察+payload+门禁通过;CONTROL 逐字节不变", async () => {
    const { env, control, controlKV, publicCache, fetchImpl } = makeTestEnv([
      repoRoutes({}),
    ]);
    const settings = await control.putSettings("1001", settingsInput, "");
    expect(settings).not.toBeNull();
    const controlWritesBeforeSync = controlKV.putKeys.length;
    await seedInventory(env.PORTFOLIO_CACHE as unknown as MemoryKV);

    const result = await handleTick(env, NOW, { fetchImpl });
    expect(result.stopped).toBe("done");

    const obs = await publicCache.getLatestObservation("1001");
    expect(obs?.eligibility).toBe("public");
    expect(obs?.releaseState).toBe("none");
    expect(obs?.payloadHash).not.toBeNull();

    const content = await publicCache.getPayload(obs!.payloadHash!);
    expect(content?.summary).toBe("主题描述");
    expect(content?.bodyHtml).toContain("Aurora");

    const verdict = evaluatePublication({
      settings: (await control.getSettings("1001"))!,
      observation: obs!,
      incidents: await publicCache.getIncidents("1001"),
      now: NOW + 60_000,
    });
    expect(verdict.publishable).toBe(true);

    // 同步绝不写 CONTROL:设置对象与写入确认逐字段一致(§8.4)
    expect(await control.getSettings("1001")).toEqual(settings);
    expect(controlKV.putKeys).toHaveLength(controlWritesBeforeSync);
  });

  it("首次坏配置仍发布基础内容;配置删除后不复活增强字段", async () => {
    let configBody: string | null = JSON.stringify({
      schemaVersion: 1,
      title: "不允许的管理字段",
      visible: true,
    });
    const { env, control, publicCache, fetchImpl } = makeTestEnv([
      repoRoutes({
        config: {
          get status() {
            return configBody === null ? 404 : 200;
          },
          get body() {
            return configBody ?? "";
          },
        },
      }),
    ]);
    await control.putSettings("1001", settingsInput, "");
    await seedInventory(env.PORTFOLIO_CACHE as unknown as MemoryKV);

    await handleTick(env, NOW, { fetchImpl });
    const invalid = await publicCache.getLatestObservation("1001");
    expect(invalid).not.toBeNull();
    expect(invalid?.configState).toBe("invalid");
    expect(invalid?.mode).toBe("basic");
    expect(invalid?.payloadHash).not.toBeNull();
    expect((await publicCache.getPayload(invalid!.payloadHash!))?.title).toBe(
      "aurora-theme"
    );

    configBody = null;
    await handleTick(env, NOW + 61 * 60_000, { fetchImpl });
    const deleted = await publicCache.getLatestObservation("1001");
    expect(deleted?.configState).toBe("absent");
    expect(deleted?.mode).toBe("basic");
    expect(deleted?.payloadHash).not.toBeNull();
    expect((await publicCache.getPayload(deleted!.payloadHash!))?.title).toBe(
      "aurora-theme"
    );
  });

  it("私有仓库:墓碑 + unavailable;门禁拒绝", async () => {
    const { env, control, publicCache, fetchImpl } = makeTestEnv([
      repoRoutes({ repo: { ...repoJson, private: true } }),
    ]);
    await control.putSettings("1001", settingsInput, "");
    await seedInventory(env.PORTFOLIO_CACHE as unknown as MemoryKV);
    await handleTick(env, NOW, { fetchImpl });

    const incidents = await publicCache.getIncidents("1001");
    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.reason).toBe("private");
    const obs = await publicCache.getLatestObservation("1001");
    expect(obs?.eligibility).toBe("unavailable");
    const verdict = evaluatePublication({
      settings: (await control.getSettings("1001"))!,
      observation: obs!,
      incidents,
      now: NOW,
    });
    expect(verdict.publishable).toBe(false);
  });

  it("坏配置:保留 LKG 引用;Release 独立出现与删除;资格独立续期", async () => {
    let configBody = JSON.stringify({
      schemaVersion: 1,
      title: "增强标题",
      techStack: ["Rust"],
    });
    let release: { status: number; body: Record<string, unknown> } | null =
      null;
    let sha = "sha-1";
    const { env, control, publicCache, fetchImpl } = makeTestEnv([
      repoRoutes({
        get sha() {
          return sha;
        },
        config: {
          get status() {
            return 200;
          },
          get body() {
            return configBody;
          },
        },
        get release() {
          return release;
        },
      }),
    ]);
    await control.putSettings("1001", settingsInput, "");
    await seedInventory(env.PORTFOLIO_CACHE as unknown as MemoryKV);
    void fetchImpl;

    await handleTick(env, NOW, {
      fetchImpl: (url, init) => {
        void init;
        const u = String(url);
        if (u.includes("/contents/.portfolio/portfolio.json")) {
          const body = Buffer.from(configBody, "utf8").toString("base64");
          return Promise.resolve(
            new Response(
              JSON.stringify({
                content: body,
                encoding: "base64",
                size: body.length,
              }),
              {
                status: 200,
              }
            )
          );
        }
        return fetchImpl(url, init);
      },
    });
    const good = await publicCache.getLatestObservation("1001");
    expect(good?.mode).toBe("enhanced");
    expect(good?.payloadHash).not.toBeNull();
    const goodPayload = await publicCache.getPayload(good!.payloadHash!);
    expect(goodPayload?.title).toBe("增强标题");

    // 第二轮:配置损坏 + 新 Release 出现(时间前移 61 分钟触发内容同步)
    configBody = '{"schemaVersion":1,"visible":true}';
    release = {
      status: 200,
      body: {
        tag_name: "v9.9.9",
        published_at: "2026-09-01T00:00:00Z",
        html_url:
          "https://github.com/jesongit/aurora-theme/releases/tag/v9.9.9",
        zipball_url: "https://github.com/jesongit/aurora-theme/zipball/v9.9.9",
        tarball_url: "https://github.com/jesongit/aurora-theme/tarball/v9.9.9",
        assets: [],
      },
    };
    sha = "sha-2";
    await handleTick(env, NOW + 61 * 60_000, { fetchImpl });

    const after = await publicCache.getLatestObservation("1001");
    expect(after?.configState).toBe("invalid");
    expect(after?.mode).toBe("enhanced");
    expect(after?.payloadHash).toBe(good?.payloadHash); // 坏配置不替换内容引用
    expect(after?.releaseState).toBe("present"); // Release 独立更新
    expect(after?.lastPublicVerifiedAt).not.toBe(good?.lastPublicVerifiedAt);

    // 第三轮:Release 删除 → releaseState=none,内容引用仍保持
    release = null;
    await handleTick(env, NOW + 122 * 60_000, { fetchImpl });
    const third = await publicCache.getLatestObservation("1001");
    expect(third?.releaseState).toBe("none");
    expect(third?.payloadHash).toBe(good?.payloadHash);
  });

  it("限流:tick 停止给 retryAt;资格不清除、不续期;401 抛 CredentialError", async () => {
    let repoStatus = 200;
    const { env, control, publicCache, fetchImpl } = makeTestEnv([
      {
        match: url => url.startsWith(REPO_PREFIX),
        reply: url => {
          if (url.endsWith("/commits/main"))
            return { status: 200, json: { sha: "sha-1" } };
          if (url.endsWith("/readme"))
            return {
              status: 200,
              json: { content: btoa("# A"), encoding: "base64", size: 4 },
            };
          if (url.includes("/contents/.portfolio/portfolio.json"))
            return { status: 404, json: { message: "Not Found" } };
          if (url.endsWith("/releases/latest"))
            return { status: 404, json: { message: "Not Found" } };
          return {
            status: repoStatus,
            json: repoJson,
            headers:
              repoStatus === 429
                ? { "Retry-After": "60" }
                : { "X-RateLimit-Remaining": "4990" },
          };
        },
      },
    ]);
    await control.putSettings("1001", settingsInput, "");
    await seedInventory(env.PORTFOLIO_CACHE as unknown as MemoryKV);

    await handleTick(env, NOW, { fetchImpl });
    const before = await publicCache.getLatestObservation("1001");
    expect(before?.eligibility).toBe("public");

    repoStatus = 429;
    const result = await handleTick(env, NOW + 11 * 60_000, { fetchImpl });
    expect(result.stopped).toBe("rate_limited");
    expect(result.retryAt).toBeDefined();

    const after = await publicCache.getLatestObservation("1001");
    expect(after?.eligibility).toBe("public");
    expect(after?.lastPublicVerifiedAt).toBe(before?.lastPublicVerifiedAt);

    // 401 → CredentialError,禁止盲重试(§9.2)
    const { GitHubClient, CredentialError } =
      await import("../../workers/portfolio-sync/src/github");
    const client = new GitHubClient({
      token: "bad-token",
      owner: "jesongit",
      ownerType: "user",
      apiVersion: "2026-03-10",
      httpCache: new SyncWriteStore(new MemoryKV()),
      fetchImpl: vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "Bad credentials" }), {
            status: 401,
          })
      ) as unknown as typeof fetch,
    });
    await expect(
      client.getRepo("jesongit/aurora-theme")
    ).rejects.toBeInstanceOf(CredentialError);
  });

  it("手动任务:queued → succeeded;过期 → expired;请求被消费", async () => {
    const { env, control, jobs, fetchImpl } = makeTestEnv([repoRoutes({})]);
    await control.putSettings("1001", settingsInput, "");
    await seedInventory(env.PORTFOLIO_CACHE as unknown as MemoryKV);

    const live: SyncJob = {
      schemaVersion: 1,
      jobId: "job-1",
      scope: { kind: "repo", repoId: "1001" },
      requestedBy: "admin@example.com",
      createdAt: new Date(NOW).toISOString(),
      expiresAt: new Date(NOW + 60_000).toISOString(),
    };
    const expiredJob: SyncJob = {
      schemaVersion: 1,
      jobId: "job-old",
      scope: { kind: "repo", repoId: "1001" },
      requestedBy: "admin@example.com",
      createdAt: new Date(NOW - 48 * 3600_000).toISOString(),
      expiresAt: new Date(NOW - 3600_000).toISOString(),
    };
    await jobs.putRequest(live);
    await jobs.putRequest(expiredJob);

    const result = await handleTick(env, NOW, { fetchImpl });
    expect(result.processed).toBeGreaterThanOrEqual(2);
    expect((await jobs.getResults("job-1"))[0]?.state).toBe("succeeded");
    expect((await jobs.getResults("job-old"))[0]?.state).toBe("expired");
    expect(await jobs.getRequest("job-1")).toBeNull();
    expect(await jobs.getRequest("job-old")).toBeNull();
  });

  it("观察不可变 key:晚写入的旧观察不会覆盖新观察", async () => {
    const { cacheKV, publicCache } = makeTestEnv([]);
    const cache = new SyncWriteStore(cacheKV);
    const mkObs = (at: string) => ({
      schemaVersion: 1,
      repoId: "1001",
      nodeId: "n",
      fullName: "jesongit/aurora-theme",
      eligibility: "public" as const,
      attemptState: "success" as const,
      observedAt: at,
      lastPublicVerifiedAt: at,
      payloadHash: "h",
      configState: "absent" as const,
      mode: "basic" as const,
      releaseState: "none" as const,
      lastContentSuccessAt: at,
      warnings: [],
    });
    await cache.putObservation(mkObs("2026-09-09T12:00:00Z"), "run-new");
    await cache.putObservation(mkObs("2026-09-09T11:00:00Z"), "run-old");
    const latest = await publicCache.getLatestObservation("1001");
    expect(latest?.observedAt).toBe("2026-09-09T12:00:00Z");
  });

  it("ControlStore revision 冲突:不匹配拒绝写入(尽力冲突检测 §8.4)", async () => {
    const control = new ControlStore(new MemoryKV());
    const first = await control.putSettings(
      "1001",
      settingsInput,
      "" // 无已有设置,任意 revision 均可首次写入
    );
    expect(first?.revision).toBeTruthy();

    const conflict = await control.putSettings(
      "1001",
      { ...settingsInput, visible: false },
      "stale-revision"
    );
    expect(conflict).toBeNull(); // 旧 revision 写入被拒 → 管理 API 返回 409

    const ok = await control.putSettings(
      "1001",
      { ...settingsInput, visible: false },
      first!.revision
    );
    expect(ok?.visible).toBe(false);
  });
});
