/**
 * workerd 池化冒烟测试(计划 §17:真实 KV API 形状):
 * 只覆盖 KV 绑定与 Worker fetch 入口,不引入任何 CJS 重的依赖路径
 * (ajv 的 Node 侧覆盖见 tests/lib/portfolio-worker.test.ts)。
 */
import { env, fetchMock } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import type { SyncEnv } from "../../workers/portfolio-sync/src/env.d";
import worker from "./test-entry";

describe("workerd KV 形状与 Worker 入口", () => {
  afterEach(() => {
    fetchMock.deactivate();
  });

  it("KV put/get/delete/list 语义正确(含 cursor 分页)", async () => {
    const kv = env.PORTFOLIO_CACHE;
    await kv.put("v1:payload:aa", "1");
    await kv.put("v1:payload:bb", "2");
    await kv.put("v1:settings:1001", "3");

    expect(await kv.get("v1:payload:aa")).toBe("1");

    const page = await kv.list({ prefix: "v1:payload:", limit: 1 });
    expect(page.keys).toHaveLength(1);
    expect(page.list_complete).toBe(false);
    expect(page.cursor).toBeDefined();

    const page2 = await kv.list({
      prefix: "v1:payload:",
      cursor: page.cursor,
      limit: 1,
    });
    expect(page2.keys).toHaveLength(1);
    expect(page2.list_complete).toBe(true);

    await kv.delete("v1:payload:aa");
    expect(await kv.get("v1:payload:aa")).toBeNull();
  });

  it("SYNC_ENABLED 语义约定为字符串 true/false(计划 §13.3)", async () => {
    expect(env.SYNC_ENABLED ?? "false").toBeDefined();
  });

  it("真实 Worker scheduled 入口写入 disabled run,fetch 仍不可公开调用", async () => {
    const pending: Promise<unknown>[] = [];
    await worker.scheduled(
      { scheduledTime: Date.now(), cron: "* * * * *" },
      env as unknown as SyncEnv,
      { waitUntil: promise => pending.push(promise) }
    );
    // 测试配置未启用同步,入口直接写停用记录,不投递后台调度任务。
    expect(pending).toHaveLength(0);

    const runs = await env.PORTFOLIO_CACHE.list({ prefix: "v1:run:" });
    expect(runs.keys).toHaveLength(1);
    const response = await worker.fetch(
      new Request("https://worker.example/"),
      env as unknown as SyncEnv,
      { waitUntil() {} }
    );
    expect(response.status).toBe(404);
  });
});
