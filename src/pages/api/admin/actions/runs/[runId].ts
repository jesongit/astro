import type { APIRoute } from "astro";
import {
  adminIntegrationError,
  adminRuntime,
  jsonError,
  jsonOk,
  notConfigured,
} from "@/lib/admin/api";

export const prerender = false;

/** GET /api/admin/actions/runs/[runId]: normalized GitHub Actions state. */
export const GET: APIRoute = async context => {
  const runtime = adminRuntime(context.locals);
  if (!runtime) return notConfigured();
  if (!context.locals.adminIdentity) {
    return jsonError(401, "unauthenticated", "未通过管理鉴权。");
  }
  if (!runtime.github) {
    return jsonError(503, "github_unconfigured", "GitHub Actions 未配置。");
  }
  const runId = context.params.runId ?? "";
  if (!/^\d{1,32}$/.test(runId)) {
    return jsonError(404, "invalid_run_id", "Actions run ID 不合法。");
  }
  try {
    const run = await runtime.github.getWorkflowRun(runId);
    if (!run)
      return jsonError(404, "run_not_found", "Actions run 不存在或已过期。");
    return jsonOk({
      run,
      runId: run.runId,
      state: run.state,
      publishState: run.state === "succeeded" ? "published" : "dispatched",
    });
  } catch (error) {
    return adminIntegrationError(error);
  }
};
