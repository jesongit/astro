/**
 * Sync Worker 入口(计划 §3.2):
 * - 仅 scheduled 消费任务;fetch 固定 404;
 * - workers_dev=false / preview_urls=false(见 wrangler.jsonc),无公开入口。
 */
import { SyncWriteStore } from "../../../src/lib/portfolio/store";
import type { SyncEnv, ScheduledControllerLike } from "./env.d";

export default {
  async scheduled(
    controller: ScheduledControllerLike,
    env: SyncEnv,
    ctx: { waitUntil: (p: Promise<unknown>) => void }
  ): Promise<void> {
    // disabled 环境不加载调度器,避免将 Node 侧校验依赖带入仅做停机记录的运行时。
    if (env.SYNC_ENABLED !== "true") {
      const runId = `${controller.scheduledTime.toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
      await new SyncWriteStore(env.PORTFOLIO_CACHE).putRun(runId, {
        state: "disabled",
        at: new Date(controller.scheduledTime).toISOString(),
      });
      return;
    }
    const { handleTick } = await import("./scheduler");
    ctx.waitUntil(handleTick(env, controller.scheduledTime));
  },

  async fetch(): Promise<Response> {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
};
