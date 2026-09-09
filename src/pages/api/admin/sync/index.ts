import type { APIRoute } from "astro";
import {
  adminIntegrationError,
  adminRuntime,
  jsonError,
  jsonOk,
  notConfigured,
  readJsonBody,
} from "@/lib/admin/api";
import { encodeActionHandle, type ActionsScope } from "@/lib/admin/github";
import { SYNC } from "@/lib/portfolio/config";
import type { SyncJob } from "@/lib/portfolio/types";

export const prerender = false;

const ALLOWED_KEYS = ["scope"] as const;

/**
 * POST /api/admin/sync(计划 §10.2/§8.2):
 * 创建手动任务,返回 202 + jobId,不谎称同步已完成;
 * 全量 10 分钟 / 单仓库 60 秒冷却(KV 尽力冷却,边缘限流兜底)。
 */
export const POST: APIRoute = async context => {
  const runtime = adminRuntime(context.locals);
  if (!runtime) return notConfigured();
  const identity = context.locals.adminIdentity;
  if (!identity) return jsonError(401, "unauthenticated", "未通过管理鉴权。");
  const parsed = await readJsonBody(context.request, ALLOWED_KEYS);
  if (!parsed.ok) return parsed.response;
  const scope = parsed.body.scope;
  if (typeof scope !== "object" || scope === null) {
    return jsonError(400, "invalid_scope", "缺少 scope。");
  }
  const s = scope as Record<string, unknown>;
  let normalizedScope: ActionsScope;
  if (s.kind === "all" && Object.keys(s).length === 1) {
    normalizedScope = { kind: "all" };
  } else if (
    s.kind === "repo" &&
    typeof s.repoId === "string" &&
    Object.keys(s).length === 2
  ) {
    if (!/^\d{1,12}$/.test(s.repoId)) {
      return jsonError(422, "invalid_field", "repoId 不合法。");
    }
    normalizedScope = { kind: "repo", repoId: s.repoId };
  } else {
    return jsonError(422, "invalid_scope", "scope 只支持 all 或 repo+repoId。");
  }

  // Keep the pre-migration queue usable for an explicitly unconfigured local
  // deployment. Production uses the GitHub Actions path below whenever the
  // server-side GitHub token is present.
  if (!runtime.github) {
    if (!runtime.jobs) return notConfigured();
    const now = Date.now();
    const existing = await runtime.jobs.listRequests();
    const cooldown =
      normalizedScope.kind === "all"
        ? SYNC.fullSyncCooldownMs
        : SYNC.repoSyncCooldownMs;
    if (
      existing.some(({ job }) => {
        const same =
          (normalizedScope.kind === "all" && job.scope.kind === "all") ||
          (normalizedScope.kind === "repo" &&
            job.scope.kind === "repo" &&
            job.scope.repoId === normalizedScope.repoId);
        return same && now - Date.parse(job.createdAt) < cooldown;
      })
    ) {
      const retryAt = new Date(now + cooldown).toISOString();
      return jsonError(429, "cooldown", "同步请求过于频繁,请稍后重试。", {
        retryAt,
      });
    }
    const job: SyncJob = {
      schemaVersion: 1,
      jobId: crypto.randomUUID(),
      scope: normalizedScope as SyncJob["scope"],
      requestedBy: identity.email,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SYNC.jobExpiresMs).toISOString(),
    };
    await runtime.jobs.putRequest(job);
    return jsonOk({ jobId: job.jobId, state: "queued" }, 202);
  }

  try {
    const dispatched = await runtime.github.dispatchWorkflow(normalizedScope);
    const jobId = encodeActionHandle({
      dispatchId: dispatched.dispatchId,
      scope: normalizedScope,
      createdAt: dispatched.createdAt,
    });
    return jsonOk(
      {
        jobId,
        dispatchId: dispatched.dispatchId,
        runId: dispatched.runId,
        state: dispatched.state,
        scope: normalizedScope,
        requestedBy: identity.email,
        createdAt: dispatched.createdAt,
        dispatchState: "dispatched",
        publishState: "dispatched",
      },
      202
    );
  } catch (error) {
    return adminIntegrationError(error);
  }
};
