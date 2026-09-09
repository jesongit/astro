import type { APIRoute } from "astro";
import { encodeActionHandle } from "@/lib/admin/github";
import { selectPublishPlan } from "@/lib/admin/publishing";
import {
  adminIntegrationError,
  adminRuntime,
  adminSettings,
  jsonError,
  jsonOk,
  notConfigured,
  readJsonBody,
} from "@/lib/admin/api";
import { ADMIN } from "@/lib/portfolio/config";
import { settingsEntry, settingsRevision } from "@/lib/admin/settings";

export const prerender = false;

const ALLOWED_KEYS = [
  "visible",
  "featured",
  "order",
  "revision",
  "sha",
  "baseSha",
  "expectedSha",
  "acknowledgedIncidentId",
] as const;

/**
 * PATCH /api/admin/repos/[repoId]/settings(计划 §10.2/§8.4):
 * 仅接受 visible/featured/order + 已读 revision + incident 确认;
 * revision 不匹配返回 409(尽力冲突检测);审计记录前后差异。
 */
export const PATCH: APIRoute = async context => {
  const runtime = adminRuntime(context.locals);
  if (!runtime) return notConfigured();
  const identity = context.locals.adminIdentity;
  if (!identity) return jsonError(401, "unauthenticated", "未通过管理鉴权。");
  const backend = adminSettings(runtime);
  if (!backend) {
    return jsonError(503, "settings_unconfigured", "GitHub 设置存储未配置。");
  }

  const repoId = context.params.repoId ?? "";
  if (!/^\d{1,12}$/.test(repoId)) {
    return jsonError(404, "invalid_repo_id", "仓库 ID 不合法。");
  }

  const parsed = await readJsonBody(context.request, ALLOWED_KEYS);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body as {
    visible?: unknown;
    featured?: unknown;
    order?: unknown;
    revision?: unknown;
    sha?: unknown;
    baseSha?: unknown;
    expectedSha?: unknown;
    acknowledgedIncidentId?: unknown;
  };

  const revisionResult = parseRevisionAliases(body);
  if (!revisionResult.ok) return revisionResult.response;
  if (!revisionResult.provided) {
    return jsonError(400, "revision_required", "必须携带已读设置文件 SHA。");
  }
  const revision = revisionResult.value;

  let snapshot;
  try {
    snapshot = await backend.read();
  } catch (error) {
    return adminIntegrationError(error);
  }
  const before = settingsEntry(snapshot, repoId);
  // 首次保存时设置记录尚不存在,前端读取到空字符串作为“已读 revision”。
  // 只有已有设置时才要求非空 revision,避免首次保存被错误拦截。
  if (revision === undefined || (revision === "" && before !== null)) {
    return jsonError(400, "revision_required", "必须携带已读 revision。");
  }

  if (before && settingsRevision(snapshot, repoId) !== revision) {
    return jsonError(
      409,
      "revision_conflict",
      "设置已被他人修改,请刷新后重试。"
    );
  }

  if (body.visible !== undefined && typeof body.visible !== "boolean") {
    return jsonError(422, "invalid_field", "visible 必须是布尔值。");
  }
  if (body.featured !== undefined && typeof body.featured !== "boolean") {
    return jsonError(422, "invalid_field", "featured 必须是布尔值。");
  }
  if (body.order !== undefined) {
    if (
      typeof body.order !== "number" ||
      !Number.isInteger(body.order) ||
      body.order < ADMIN.orderMin ||
      body.order > ADMIN.orderMax
    ) {
      return jsonError(
        422,
        "invalid_field",
        "order 必须是 0..1000000 的整数。"
      );
    }
  }
  if (
    body.acknowledgedIncidentId !== undefined &&
    body.acknowledgedIncidentId !== null &&
    typeof body.acknowledgedIncidentId !== "string"
  ) {
    return jsonError(
      422,
      "invalid_field",
      "acknowledgedIncidentId 必须是字符串。"
    );
  }

  // 恢复展示必须显式确认最新 incident(由服务端按当前事件生成,§8.4)
  if (body.visible === true && body.acknowledgedIncidentId === undefined) {
    const incidents = runtime.cache
      ? await runtime.cache.getIncidents(repoId)
      : [];
    if (incidents.length > 0) {
      const latest = incidents.reduce((a, b) =>
        Date.parse(a.observedAt) >= Date.parse(b.observedAt) ? a : b
      );
      if (before?.acknowledgedIncidentId !== latest.incidentId) {
        return jsonError(
          409,
          "incident_acknowledgement_required",
          "存在未确认的撤下事件,需先确认后才能恢复展示。",
          {
            fieldErrors: [
              { path: "acknowledgedIncidentId", message: latest.incidentId },
            ],
          }
        );
      }
    }
  }

  const patch: Record<string, unknown> = {};
  if (body.visible !== undefined) patch.visible = body.visible;
  if (body.featured !== undefined) patch.featured = body.featured;
  if (body.order !== undefined) patch.order = body.order;
  if (body.acknowledgedIncidentId !== undefined) {
    patch.acknowledgedIncidentId = body.acknowledgedIncidentId;
  }
  try {
    const saved = await backend.save(
      { [repoId]: patch },
      revision,
      identity.email
    );
    let publishState = "not_dispatched";
    let publishJobId: string | null = null;
    let publishMode: "build" | "repo" | "all" | null = null;
    if (saved.committed && runtime.github) {
      try {
        const plan = selectPublishPlan(saved.settings);
        const dispatched = await runtime.github.dispatchWorkflow(plan.scope);
        publishState = "dispatched";
        publishMode = plan.mode;
        publishJobId = encodeActionHandle({
          dispatchId: dispatched.dispatchId,
          scope: plan.scope,
          createdAt: dispatched.createdAt,
        });
      } catch {
        publishState = "dispatch_failed";
      }
    }
    const entry = saved.settings[repoId] ?? {
      visible: false,
      featured: false,
      order: ADMIN.defaultOrder,
      acknowledgedIncidentId: null,
    };
    return jsonOk({
      source: saved.source,
      committed: saved.committed,
      saveState: saved.committed ? "saved" : "unchanged",
      publishState,
      publishMode,
      publishJobId,
      changedRepoIds: saved.changedRepoIds,
      settings: {
        ...entry,
        repoId,
        revision: saved.revisions[repoId] ?? saved.sha ?? "",
      },
      sha: saved.sha,
      commitSha: saved.commitSha,
    });
  } catch (error) {
    return adminIntegrationError(error);
  }
};

export const PUT = PATCH;

function parseRevisionAliases(
  body: Record<string, unknown>
):
  | { ok: true; value: string | undefined; provided: boolean }
  | { ok: false; response: Response } {
  const aliases = ["revision", "sha", "baseSha", "expectedSha"]
    .filter(key => body[key] !== undefined)
    .map(key => body[key]);
  if (aliases.length === 0)
    return { ok: true, value: undefined, provided: false };
  if (aliases.some(value => typeof value !== "string")) {
    return {
      ok: false,
      response: jsonError(
        400,
        "revision_required",
        "设置文件 SHA 必须是字符串。"
      ),
    };
  }
  const unique = new Set(aliases as string[]);
  if (unique.size > 1) {
    return {
      ok: false,
      response: jsonError(
        409,
        "settings_conflict",
        "设置文件 SHA 参数不一致。"
      ),
    };
  }
  return { ok: true, value: aliases[0] as string, provided: true };
}
