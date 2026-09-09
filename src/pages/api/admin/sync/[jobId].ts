import type { APIRoute } from "astro";
import {
  adminRuntime,
  jsonError,
  jsonOk,
  notConfigured,
} from "@/lib/admin/api";

export const prerender = false;

/** GET /api/admin/sync/[jobId]:任务状态、计数、错误码、retryAt(§10.2) */
export const GET: APIRoute = async context => {
  const runtime = adminRuntime(context.locals);
  if (!runtime) return notConfigured();

  const jobId = context.params.jobId ?? "";
  if (!jobId || jobId.length > 64) {
    return jsonError(404, "invalid_job_id", "任务 ID 不合法。");
  }

  const request = await runtime.jobs.getRequest(jobId);
  const results = await runtime.jobs.getResults(jobId);
  if (!request && results.length === 0) {
    return jsonError(404, "job_not_found", "任务不存在或已过期。");
  }

  const latest = results[0] ?? null;
  return jsonOk({
    jobId,
    request: request ?? null,
    results,
    state: latest?.state ?? (request ? "queued" : "unknown"),
    counts: latest?.counts ?? null,
    errorCodes: latest?.errorCodes ?? null,
    retryAt: latest?.retryAt ?? null,
  });
};
