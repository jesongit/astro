import { describe, expect, it } from "vitest";
import { POST as reorder } from "../../src/pages/api/admin/reorder";
import { GET as getRepos } from "../../src/pages/api/admin/repos";
import { PATCH as patchSettings } from "../../src/pages/api/admin/repos/[repoId]/settings";
import { POST as requestSync } from "../../src/pages/api/admin/sync";
import {
  ControlStore,
  JobsStore,
  SyncWriteStore,
  type PortfolioKV,
} from "../../src/lib/portfolio/store";
import type { Inventory } from "../../src/lib/portfolio/types";

class MemoryKV implements PortfolioKV {
  private readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async list(options: { prefix: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
  }> {
    return {
      keys: [...this.values.keys()]
        .filter(key => key.startsWith(options.prefix))
        .sort()
        .map(name => ({ name })),
      list_complete: true,
    };
  }
}

const identity = { email: "admin@example.com", sub: "admin-sub" };

function context(
  handler:
    | typeof getRepos
    | typeof reorder
    | typeof patchSettings
    | typeof requestSync,
  kv: MemoryKV,
  body?: unknown,
  params: Record<string, string> = {},
  search = ""
) {
  const method =
    handler === getRepos ? "GET" : handler === patchSettings ? "PATCH" : "POST";
  return {
    request: new Request(`https://example.com/api/admin/test${search}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    params,
    locals: {
      adminIdentity: identity,
      runtime: {
        env: {
          PORTFOLIO_CONTROL: kv,
          PORTFOLIO_CACHE: kv,
          PORTFOLIO_JOBS: kv,
        },
      },
    },
  } as Parameters<typeof handler>[0];
}

const json = async (response: Response): Promise<Record<string, unknown>> =>
  (await response.json()) as Record<string, unknown>;

const settingsInput = {
  schemaVersion: 1 as const,
  repoId: "1001",
  visible: true,
  featured: true,
  order: 10,
  acknowledgedIncidentId: null,
  updatedBy: "admin@example.com",
};

describe("管理 API 验收边界", () => {
  it("没有完整 inventory 时返回明确空配置状态", async () => {
    const response = await getRepos(context(getRepos, new MemoryKV()));
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.repos).toEqual([]);
    expect(body.cursor).toBeNull();
    expect(body.inventoryComplete).toBe(false);
    expect(body.inventoryObservedAt).toBeNull();
  });

  it("候选列表按 100 项分页,下一页只返回剩余项", async () => {
    const kv = new MemoryKV();
    const cache = new SyncWriteStore(kv);
    const inventory: Inventory = {
      schemaVersion: 1,
      runId: "inventory-run",
      completed: true,
      observedAt: "2026-09-09T12:00:00.000Z",
      repos: Array.from({ length: 101 }, (_, index) => ({
        repoId: String(index + 1),
        fullName: `jesongit/project-${index + 1}`,
        nodeId: `node-${index + 1}`,
      })),
    };
    await cache.putInventory(inventory);

    const first = await getRepos(context(getRepos, kv));
    const firstBody = await json(first);
    const second = await getRepos(
      context(getRepos, kv, undefined, {}, "?cursor=100")
    );
    const secondBody = await json(second);

    expect(first.status).toBe(200);
    expect(firstBody.repos).toHaveLength(100);
    expect(firstBody.cursor).toBe("100");
    expect(secondBody.repos).toHaveLength(1);
    expect(secondBody.repos[0].repoId).toBe("101");
    expect(secondBody.cursor).toBeNull();
  });

  it("脏保存只改变提交字段,旧 revision 保存返回 409", async () => {
    const kv = new MemoryKV();
    const control = new ControlStore(kv);
    const first = await control.putSettings("1001", settingsInput, "");
    expect(first).not.toBeNull();

    const saved = await patchSettings(
      context(
        patchSettings,
        kv,
        { visible: false, revision: first!.revision },
        { repoId: "1001" }
      )
    );
    const savedBody = await json(saved);
    const current = await control.getSettings("1001");

    expect(saved.status).toBe(200);
    expect(savedBody.settings.visible).toBe(false);
    expect(current?.featured).toBe(true);
    expect(current?.order).toBe(10);
    expect(current?.updatedBy).toBe(identity.email);

    const conflict = await patchSettings(
      context(
        patchSettings,
        kv,
        { visible: true, revision: first!.revision },
        { repoId: "1001" }
      )
    );
    expect(conflict.status).toBe(409);
    expect((await json(conflict)).code).toBe("revision_conflict");
    expect((await control.getSettings("1001"))?.visible).toBe(false);
  });

  it("批量重排显式报告部分冲突,不谎称全部成功", async () => {
    const kv = new MemoryKV();
    const control = new ControlStore(kv);
    const first = await control.putSettings("1001", settingsInput, "");
    await control.putSettings("1002", { ...settingsInput, repoId: "1002" }, "");

    const response = await reorder(
      context(reorder, kv, {
        items: [
          { repoId: "1001", revision: first!.revision, order: 20 },
          { repoId: "1002", revision: "stale-revision", order: 30 },
        ],
      })
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.allSucceeded).toBe(false);
    expect(body.results).toEqual([
      expect.objectContaining({ repoId: "1001", ok: true }),
      { repoId: "1002", ok: false, code: "revision_conflict" },
    ]);
    expect((await control.getSettings("1002"))?.order).toBe(10);
  });

  it("单仓库同步返回 202 queued,重复请求进入冷却", async () => {
    const kv = new MemoryKV();
    const response = await requestSync(
      context(requestSync, kv, { scope: { kind: "repo", repoId: "1001" } })
    );
    const body = await json(response);
    const job = await new JobsStore(kv).getRequest(body.jobId as string);

    expect(response.status).toBe(202);
    expect(body.state).toBe("queued");
    expect(typeof body.jobId).toBe("string");
    expect(job?.scope).toEqual({ kind: "repo", repoId: "1001" });

    const duplicate = await requestSync(
      context(requestSync, kv, { scope: { kind: "repo", repoId: "1001" } })
    );
    expect(duplicate.status).toBe(429);
    expect((await json(duplicate)).code).toBe("cooldown");
  });

  it("管理写接口拒绝未知字段、超限 body 和任意仓库 URL", async () => {
    const kv = new MemoryKV();
    const unknownField = await patchSettings(
      context(
        patchSettings,
        kv,
        { visible: true, revision: "", slug: "https://evil.example" },
        { repoId: "1001" }
      )
    );
    expect(unknownField.status).toBe(422);
    expect((await json(unknownField)).code).toBe("unknown_fields");

    const oversized = await patchSettings(
      context(
        patchSettings,
        kv,
        { visible: true, revision: "x".repeat(16 * 1024) },
        { repoId: "1001" }
      )
    );
    expect(oversized.status).toBe(413);

    const arbitraryRepo = await requestSync(
      context(requestSync, kv, {
        scope: { kind: "repo", repoId: "https://evil.example/repo" },
      })
    );
    expect(arbitraryRepo.status).toBe(422);
    expect((await json(arbitraryRepo)).code).toBe("invalid_field");
  });
});
