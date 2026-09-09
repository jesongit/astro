import type { APIRoute } from "astro";
import {
  adminRuntime,
  jsonError,
  jsonOk,
  notConfigured,
  readJsonBody,
} from "@/lib/admin/api";
import { ADMIN } from "@/lib/portfolio/config";
import type { AuditEntry, DisplaySettings } from "@/lib/portfolio/types";

export const prerender = false;

const ALLOWED_KEYS = [
  "visible",
  "featured",
  "order",
  "revision",
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
    acknowledgedIncidentId?: unknown;
  };

  const before = await runtime.control.getSettings(repoId);
  // 首次保存时设置记录尚不存在,前端读取到空字符串作为“已读 revision”。
  // 只有已有设置时才要求非空 revision,避免首次保存被错误拦截。
  if (
    typeof body.revision !== "string" ||
    (body.revision === "" && before !== null)
  ) {
    return jsonError(400, "revision_required", "必须携带已读 revision。");
  }

  if (before && before.revision !== body.revision) {
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
    const incidents = await runtime.cache.getIncidents(repoId);
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

  const next: Omit<DisplaySettings, "revision" | "updatedAt"> = {
    schemaVersion: 1,
    repoId,
    visible:
      typeof body.visible === "boolean"
        ? body.visible
        : (before?.visible ?? false),
    featured:
      typeof body.featured === "boolean"
        ? body.featured
        : (before?.featured ?? false),
    order:
      typeof body.order === "number"
        ? body.order
        : (before?.order ?? ADMIN.defaultOrder),
    acknowledgedIncidentId:
      typeof body.acknowledgedIncidentId === "string"
        ? body.acknowledgedIncidentId
        : (before?.acknowledgedIncidentId ?? null),
    updatedBy: identity.email,
  };
  // 取消精选/隐藏时精选无效:保留字段但公开层忽略(§4.1)
  const saved = await runtime.control.putSettings(repoId, next, body.revision);
  if (!saved) {
    return jsonError(409, "revision_conflict", "设置已被修改,请刷新后重试。");
  }

  const audit: AuditEntry = {
    schemaVersion: 1,
    at: new Date().toISOString(),
    actor: identity.email,
    repoId,
    action: "settings.update",
    before: before
      ? {
          visible: before.visible,
          featured: before.featured,
          order: before.order,
          acknowledgedIncidentId: before.acknowledgedIncidentId,
        }
      : null,
    after: {
      visible: saved.visible,
      featured: saved.featured,
      order: saved.order,
      acknowledgedIncidentId: saved.acknowledgedIncidentId,
    },
  };
  await runtime.control.appendAudit(audit);

  return jsonOk({ settings: saved });
};
