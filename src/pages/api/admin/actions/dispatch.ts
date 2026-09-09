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

export const prerender = false;

const ALLOWED_KEYS = ["scope"] as const;

/** Explicit Actions API alias used by newer admin clients. */
export const POST: APIRoute = async context => {
  const runtime = adminRuntime(context.locals);
  if (!runtime) return notConfigured();
  const identity = context.locals.adminIdentity;
  if (!identity) return jsonError(401, "unauthenticated", "未通过管理鉴权。");
  if (!runtime.github) {
    return jsonError(503, "github_unconfigured", "GitHub Actions 未配置。");
  }

  const parsed = await readJsonBody(context.request, ALLOWED_KEYS);
  if (!parsed.ok) return parsed.response;
  const scope = normalizeScope(parsed.body.scope);
  if (!scope)
    return jsonError(422, "invalid_scope", "scope 只支持 all 或 repo+repoId。");

  try {
    const dispatched = await runtime.github.dispatchWorkflow(scope);
    const jobId = encodeActionHandle({
      dispatchId: dispatched.dispatchId,
      scope,
      createdAt: dispatched.createdAt,
    });
    return jsonOk(
      {
        jobId,
        dispatchId: dispatched.dispatchId,
        runId: dispatched.runId,
        state: dispatched.state,
        scope,
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

function normalizeScope(value: unknown): ActionsScope | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const record = value as Record<string, unknown>;
  if (record.kind === "all" && Object.keys(record).length === 1)
    return { kind: "all" };
  if (
    record.kind === "repo" &&
    typeof record.repoId === "string" &&
    /^\d{1,12}$/.test(record.repoId) &&
    Object.keys(record).length === 2
  ) {
    return { kind: "repo", repoId: record.repoId };
  }
  return null;
}
