/**
 * Sync Worker 入口(计划 §3.2):
 * - 仅 scheduled 消费任务;fetch 固定 404;
 * - workers_dev=false / preview_urls=false(见 wrangler.jsonc),无公开入口。
 */
import { handleTick } from "./scheduler";
import type { SyncEnv, ScheduledControllerLike } from "./env.d";

export default {
  async scheduled(
    controller: ScheduledControllerLike,
    env: SyncEnv,
    ctx: { waitUntil: (p: Promise<unknown>) => void }
  ): Promise<void> {
    ctx.waitUntil(handleTick(env, controller.scheduledTime));
  },

  async fetch(): Promise<Response> {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
};
