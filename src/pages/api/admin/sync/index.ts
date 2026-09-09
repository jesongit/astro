import type { APIRoute } from "astro";
import {
  adminRuntime,
  jsonError,
  jsonOk,
  notConfigured,
  readJsonBody,
} from "@/lib/admin/api";
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
  let normalizedScope: SyncJob["scope"];
  if (s.kind === "all") {
    normalizedScope = { kind: "all" };
  } else if (s.kind === "repo" && typeof s.repoId === "string") {
    if (!/^\d{1,12}$/.test(s.repoId)) {
      return jsonError(422, "invalid_field", "repoId 不合法。");
    }
    normalizedScope = { kind: "repo", repoId: s.repoId };
  } else {
    return jsonError(422, "invalid_scope", "scope 只支持 all 或 repo+repoId。");
  }

  // 尽力冷却:检查同 scope 最近一次请求时间(JOBS 内)
  const now = Date.now();
  const existing = await runtime.jobs.listRequests();
  const cooldown =
    normalizedScope.kind === "all"
      ? SYNC.fullSyncCooldownMs
      : SYNC.repoSyncCooldownMs;
  for (const { job } of existing) {
    const sameScope =
      (normalizedScope.kind === "all" && job.scope.kind === "all") ||
      (normalizedScope.kind === "repo" &&
        job.scope.kind === "repo" &&
        job.scope.repoId === normalizedScope.repoId);
    if (!sameScope) continue;
    const created = Date.parse(job.createdAt);
    if (now - created < cooldown) {
      const retryAt = new Date(created + cooldown).toISOString();
      return jsonError(429, "cooldown", "同步请求过于频繁,请稍后重试。", {
        retryAt,
      });
    }
  }

  const jobId = crypto.randomUUID();
  const job: SyncJob = {
    schemaVersion: 1,
    jobId,
    scope: normalizedScope,
    requestedBy: identity.email,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SYNC.jobExpiresMs).toISOString(),
  };
  await runtime.jobs.putRequest(job);

  return jsonOk({ jobId, state: "queued" }, 202);
};
