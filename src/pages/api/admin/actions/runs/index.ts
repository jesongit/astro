import type { APIRoute } from "astro";
import {
  adminIntegrationError,
  adminRuntime,
  jsonError,
  jsonOk,
  notConfigured,
} from "@/lib/admin/api";

export const prerender = false;

/** GET /api/admin/actions/runs: recent manual workflow runs. */
export const GET: APIRoute = async context => {
  const runtime = adminRuntime(context.locals);
  if (!runtime) return notConfigured();
  if (!context.locals.adminIdentity) {
    return jsonError(401, "unauthenticated", "未通过管理鉴权。");
  }
  if (!runtime.github) {
    return jsonError(503, "github_unconfigured", "GitHub Actions 未配置。");
  }
  try {
    return jsonOk({ runs: await runtime.github.listWorkflowRuns() });
  } catch (error) {
    return adminIntegrationError(error);
  }
};
