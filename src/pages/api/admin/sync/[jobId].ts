import type { APIRoute } from "astro";
import {
  adminIntegrationError,
  adminRuntime,
  jsonError,
  jsonOk,
  notConfigured,
} from "@/lib/admin/api";
import { decodeActionHandle, type ActionRunSummary } from "@/lib/admin/github";

export const prerender = false;

/** GET /api/admin/sync/[jobId]:任务状态、计数、错误码、retryAt(§10.2) */
export const GET: APIRoute = async context => {
  const runtime = adminRuntime(context.locals);
  if (!runtime) return notConfigured();
  if (!context.locals.adminIdentity) {
    return jsonError(401, "unauthenticated", "未通过管理鉴权。");
  }

  const jobId = context.params.jobId ?? "";
  if (!jobId || jobId.length > 512) {
    return jsonError(404, "invalid_job_id", "任务 ID 不合法。");
  }

  if (!runtime.github) {
    return jsonError(503, "github_unconfigured", "GitHub Actions 未配置。");
  }

  try {
    let run: ActionRunSummary | null = null;
    const handle = decodeActionHandle(jobId);
    if (/^\d{1,32}$/.test(jobId)) {
      run = await runtime.github.getWorkflowRun(jobId);
      if (!run)
        return jsonError(404, "run_not_found", "Actions run 不存在或已过期。");
    } else if (!handle) {
      return jsonError(404, "invalid_job_id", "任务 ID 不合法。");
    } else {
      const runs = await runtime.github.listWorkflowRuns();
      const startAt = Date.parse(handle.createdAt);
      run =
        runs
          .filter(candidate => {
            const createdAt = candidate.createdAt
              ? Date.parse(candidate.createdAt)
              : NaN;
            return (
              Number.isFinite(startAt) &&
              Number.isFinite(createdAt) &&
              createdAt >= startAt - 60_000
            );
          })
          .sort(
            (a, b) =>
              Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? "")
          )[0] ?? null;
    }

    return jsonOk({
      jobId,
      runId: run?.runId ?? null,
      run,
      state: run?.state ?? "queued",
      counts: null,
      errorCodes: null,
      retryAt: null,
      publishState: run?.state === "succeeded" ? "published" : "dispatched",
    });
  } catch (error) {
    return adminIntegrationError(error);
  }
};
