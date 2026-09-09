/**
 * 每 tick 调度(计划 §8.2):
 * 预算:单 tick 40 秒 / 30 次上游请求;未完成保存游标,下一 tick 继续;
 * 优先级:1) 到期手动任务 2) 到期公开检查(10 分钟)3) 到期内容同步(60 分钟)
 * 4) 候选池重建(6 小时)。重复投递幂等:按仓库合并,结果可重复写。
 */
import { PUBLICATION, SYNC } from "../../../src/lib/portfolio/config";
import {
  ControlStore,
  JobsStore,
  PublicCacheStore,
  SyncWriteStore,
} from "../../../src/lib/portfolio/store";
import type {
  SourceObservation,
  SyncJob,
  SyncJobResult,
} from "../../../src/lib/portfolio/types";
import { GitHubClient, CredentialError, RateLimitedError } from "./github";
import { continueInventory, type InventoryProgress } from "./inventory";
import { syncRepoById } from "./sync-repo";
import type { SyncEnv } from "./env.d";

export interface TickResult {
  runId: string;
  disabled: boolean;
  stopped: "done" | "budget" | "credential" | "rate_limited" | "upstream";
  processed: number;
  retryAt?: number;
}

class BudgetExceeded extends Error {}

export interface TickOptions {
  /** 测试注入;生产默认全局 fetch */
  fetchImpl?: typeof fetch;
}

export async function handleTick(
  env: SyncEnv,
  now: number,
  options: TickOptions = {}
): Promise<TickResult> {
  const runId = `${now.toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  const control = new ControlStore(env.PORTFOLIO_CONTROL); // 只读:无写方法调用
  const cache = new SyncWriteStore(env.PORTFOLIO_CACHE);
  const publicCache = new PublicCacheStore(env.PORTFOLIO_CACHE);
  const jobs = new JobsStore(env.PORTFOLIO_JOBS);

  if (env.SYNC_ENABLED !== "true") {
    await cache.putRun(runId, {
      state: "disabled",
      at: new Date(now).toISOString(),
    });
    return { runId, disabled: true, stopped: "done", processed: 0 };
  }

  const deadline = now + SYNC.tickBudgetMs;
  let requestCount = 0;
  const client = new GitHubClient({
    token: env.GITHUB_TOKEN,
    owner: env.GITHUB_OWNER,
    ownerType: env.GITHUB_OWNER_TYPE,
    apiVersion: env.GITHUB_API_VERSION,
    httpCache: cache,
    fetchImpl: options.fetchImpl,
    onRequest: () => {
      requestCount += 1;
      if (requestCount > SYNC.maxUpstreamRequestsPerTick) {
        throw new BudgetExceeded();
      }
    },
  });

  const progress = await cache.getRun<InventoryProgress & { kind?: string }>(
    `inventory-cursor`
  );

  let processed = 0;
  let stopped: TickResult["stopped"] = "done";
  let retryAt: number | undefined;

  try {
    // ── 1. 到期手动任务(§8.2.1) ──
    const requests = await jobs.listRequests();
    requests.sort(
      (a, b) => Date.parse(a.job.createdAt) - Date.parse(b.job.createdAt)
    );
    for (const { jobId, job } of requests) {
      if (Date.now() > deadline) {
        stopped = "budget";
        break;
      }
      if (Date.parse(job.expiresAt) < now) {
        await jobs.putResult({
          schemaVersion: 1,
          jobId,
          runId,
          state: "expired",
          updatedAt: new Date().toISOString(),
        });
        await jobs.deleteRequest(jobId);
        continue;
      }
      const outcome = await consumeJob({
        env,
        cache,
        publicCache,
        jobs,
        client,
        job,
        jobId,
        runId,
        now,
      });
      processed += outcome ? 1 : 0;
      if (outcome?.state === "rate_limited") {
        stopped = "rate_limited";
        retryAt = outcome.retryAt;
        break;
      }
    }

    // ── 2. 到期公开检查(§8.2.2:10 分钟) ──
    if (stopped === "done") {
      const settings = await control.listAllSettings();
      const visible = settings.filter(s => s.visible);
      for (const setting of visible) {
        if (Date.now() > deadline) {
          stopped = "budget";
          break;
        }
        const obs = await publicCache.getLatestObservation(setting.repoId);
        const lastVerified = obs?.lastPublicVerifiedAt
          ? Date.parse(obs.lastPublicVerifiedAt)
          : 0;
        if (now - lastVerified < PUBLICATION.publicCheckMinutes * 60_000) {
          continue;
        }
        await lightPublicityCheck(
          {
            cache,
            publicCache,
            client,
            owner: env.GITHUB_OWNER,
            now,
            runId,
            inventoryNames: new Map(),
          },
          setting.repoId
        );
        processed += 1;
      }
    }

    // ── 3. 每小时内容同步(§8.2.2) ──
    if (stopped === "done") {
      const settings = await control.listAllSettings();
      const visible = settings.filter(s => s.visible);
      const inventory = await publicCache.getLatestInventory();
      const inventoryNames = new Map(
        (inventory?.repos ?? []).map(r => [r.repoId, r.fullName])
      );
      for (const setting of visible) {
        if (Date.now() > deadline) {
          stopped = "budget";
          break;
        }
        const obs = await publicCache.getLatestObservation(setting.repoId);
        const lastContent = obs?.lastContentSuccessAt
          ? Date.parse(obs.lastContentSuccessAt)
          : 0;
        if (now - lastContent < SYNC.contentSyncMinutes * 60_000) continue;
        await syncRepoById(
          {
            cache,
            publicCache,
            client,
            owner: env.GITHUB_OWNER,
            inventoryNames,
            now, // 与 tick 同源,保证测试确定性;生产等价于当前时间
            runId,
          },
          setting.repoId
        );
        processed += 1;
      }
    }

    // ── 4. 每 6 小时重建候选池(§8.2.2) ──
    if (stopped === "done") {
      const lastInventoryAt = await inventoryTimestamp(publicCache);
      if (now - lastInventoryAt >= SYNC.discoverySyncMinutes * 60_000) {
        const progressState =
          progress?.kind === "inventory"
            ? (progress as unknown as InventoryProgress)
            : {
                runId,
                startedAt: new Date(now).toISOString(),
                nextPage: 1,
                repos: [],
              };
        const outcome = await continueInventory(client, progressState);
        if (outcome.inventory) {
          await cache.putInventory(outcome.inventory);
          await cache.putRun("inventory-cursor", {
            kind: "inventory",
            completedAt: new Date(now).toISOString(),
          });
        } else if (outcome.progress) {
          await cache.putRun("inventory-cursor", {
            kind: "inventory",
            ...outcome.progress,
          });
          stopped = "budget";
        } else if (outcome.error?.kind === "credential") {
          stopped = "credential";
        } else if (outcome.error?.kind === "rate_limited") {
          stopped = "rate_limited";
          retryAt = outcome.error.retryAt;
        } else {
          stopped = "upstream";
        }
      }
    }
  } catch (e) {
    if (e instanceof CredentialError) {
      stopped = "credential"; // 禁止盲重试(§9.2),等待 token 修复
    } else if (e instanceof RateLimitedError) {
      stopped = "rate_limited";
      retryAt = e.retryAt;
    } else if (e instanceof BudgetExceeded) {
      stopped = "budget";
    } else {
      stopped = "upstream";
    }
  }

  await cache.putRun(runId, {
    state: stopped,
    processed,
    at: new Date(now).toISOString(),
    retryAt: retryAt ? new Date(retryAt).toISOString() : undefined,
  });
  return { runId, disabled: false, stopped, processed, retryAt };
}

async function consumeJob(ctx: {
  env: SyncEnv;
  cache: SyncWriteStore;
  publicCache: PublicCacheStore;
  jobs: JobsStore;
  client: GitHubClient;
  job: SyncJob;
  jobId: string;
  runId: string;
  now: number;
}): Promise<
  | { state: SyncJobResult["state"] }
  | { state: "rate_limited"; retryAt: number }
  | null
> {
  const { cache, publicCache, jobs, client, job, jobId, runId, env } = ctx;

  await jobs.putResult({
    schemaVersion: 1,
    jobId,
    runId,
    state: "running",
    updatedAt: new Date().toISOString(),
  });

  const inventory = await publicCache.getLatestInventory();
  const inventoryNames = new Map(
    (inventory?.repos ?? []).map(r => [r.repoId, r.fullName])
  );

  const repoIds =
    job.scope.kind === "all"
      ? (inventory?.repos ?? []).map(r => r.repoId)
      : [job.scope.repoId];

  let ok = 0;
  let failed = 0;
  for (const repoId of repoIds) {
    try {
      const outcome = await syncRepoById(
        {
          cache,
          publicCache,
          client,
          owner: env.GITHUB_OWNER,
          inventoryNames,
          now: Date.now(),
          runId,
        },
        repoId
      );
      if (outcome.state === "success" || outcome.state === "partial") ok += 1;
      else failed += 1;
    } catch (e) {
      if (e instanceof CredentialError) {
        await jobs.putResult({
          schemaVersion: 1,
          jobId,
          runId,
          state: "failed",
          errorCodes: ["credential_error"],
          updatedAt: new Date().toISOString(),
        });
        // 保留请求 key:token 修复后可重试(§9.2 禁止盲重试语义)
        return { state: "failed" };
      }
      failed += 1;
    }
  }

  await jobs.putResult({
    schemaVersion: 1,
    jobId,
    runId,
    state: failed === 0 ? "succeeded" : ok > 0 ? "partial" : "failed",
    counts: { ok, failed },
    updatedAt: new Date().toISOString(),
  });
  await jobs.deleteRequest(jobId);
  return { state: failed === 0 ? "succeeded" : "partial" };
}

/** 轻量公开性检查:只更新资格,不重建内容(§8.2.1) */
async function lightPublicityCheck(
  deps: {
    cache: SyncWriteStore;
    publicCache: PublicCacheStore;
    client: GitHubClient;
    owner: string;
    now: number;
    runId: string;
    inventoryNames: Map<string, string>;
  },
  repoId: string
): Promise<void> {
  const { cache, publicCache, client, owner, now, runId, inventoryNames } =
    deps;
  const prev = await publicCache.getLatestObservation(repoId);
  const fullName = inventoryNames.get(repoId) ?? prev?.fullName;
  if (!fullName) return;

  const observedAt = new Date(now).toISOString();
  let eligibility: SourceObservation["eligibility"] =
    prev?.eligibility ?? "unknown";
  let nodeId = prev?.nodeId ?? "";
  let attemptState: "success" | "error" = "error";

  try {
    const { status, repo } = await client.getRepo(fullName);
    if (status === 200 && repo && repo.id === Number(repoId)) {
      attemptState = "success";
      if (repo.private === true) {
        eligibility = "unavailable";
        await cache.putIncident({
          incidentId: crypto.randomUUID(),
          repoId,
          fullName,
          reason: "private",
          observedAt,
        });
      } else {
        const ownerLogin =
          typeof (repo as Record<string, unknown>).owner === "object" &&
          (repo as Record<string, unknown>).owner !== null &&
          typeof (
            (repo as Record<string, unknown>).owner as Record<string, unknown>
          ).login === "string"
            ? String(
                (
                  (repo as Record<string, unknown>).owner as Record<
                    string,
                    unknown
                  >
                ).login
              )
            : owner;
        if (ownerLogin.toLowerCase() !== owner.toLowerCase()) {
          eligibility = "out_of_scope";
          await cache.putIncident({
            incidentId: crypto.randomUUID(),
            repoId,
            fullName,
            reason: "out_of_scope",
            observedAt,
          });
        } else {
          eligibility = "public";
        }
      }
      nodeId = String(repo.node_id ?? nodeId);
    } else if (status === 404) {
      // 404 需身份恢复流程,不在轻检查中直接判死;保持原资格不续期
      attemptState = "error";
    }
  } catch (e) {
    // 限流/凭据错误必须向上传播以暂停本轮(§8.2);其他错误按资格未定处理
    if (e instanceof CredentialError || e instanceof RateLimitedError) throw e;
    attemptState = "error";
  }

  await cache.putObservation(
    {
      schemaVersion: 1,
      repoId,
      nodeId,
      fullName,
      eligibility,
      attemptState,
      observedAt,
      lastPublicVerifiedAt:
        eligibility === "public" && attemptState === "success"
          ? observedAt
          : (prev?.lastPublicVerifiedAt ?? null),
      payloadHash: prev?.payloadHash ?? null,
      configState: prev?.configState ?? "absent",
      mode: prev?.mode ?? "basic",
      releaseState: prev?.releaseState ?? "none",
      lastContentSuccessAt: prev?.lastContentSuccessAt ?? null,
      warnings: [],
    },
    runId
  );
}

async function inventoryTimestamp(
  publicCache: PublicCacheStore
): Promise<number> {
  const inventory = await publicCache.getLatestInventory();
  return inventory ? Date.parse(inventory.observedAt) : 0;
}
