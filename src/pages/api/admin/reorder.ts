import type { APIRoute } from "astro";
import {
  adminRuntime,
  jsonError,
  jsonOk,
  notConfigured,
  readJsonBody,
} from "@/lib/admin/api";
import { ADMIN } from "@/lib/portfolio/config";
import type { AuditEntry } from "@/lib/portfolio/types";

export const prerender = false;

const ALLOWED_KEYS = ["items"] as const;

interface ReorderItem {
  repoId: string;
  revision: string;
  order: number;
}

/**
 * POST /api/admin/reorder(计划 §10.2/§8.4):
 * 有序 repoId 数组及各项 revision;重复/未知 ID 拒绝;
 * 逐项保存,部分失败明确列出,不谎称原子成功。
 */
export const POST: APIRoute = async context => {
  const runtime = adminRuntime(context.locals);
  if (!runtime) return notConfigured();
  const identity = context.locals.adminIdentity;
  if (!identity) return jsonError(401, "unauthenticated", "未通过管理鉴权。");

  const parsed = await readJsonBody(context.request, ALLOWED_KEYS);
  if (!parsed.ok) return parsed.response;
  const items = parsed.body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return jsonError(400, "invalid_items", "items 必须是非空数组。");
  }

  const seen = new Set<string>();
  const normalized: ReorderItem[] = [];
  for (const raw of items) {
    if (typeof raw !== "object" || raw === null) {
      return jsonError(400, "invalid_items", "items 元素必须是对象。");
    }
    const item = raw as Record<string, unknown>;
    const repoId = item.repoId;
    const revision = item.revision;
    const order = item.order;
    if (typeof repoId !== "string" || !/^\d{1,12}$/.test(repoId)) {
      return jsonError(422, "invalid_field", "repoId 不合法。");
    }
    if (seen.has(repoId)) {
      return jsonError(422, "duplicate_repo", `repoId 重复:${repoId}`);
    }
    seen.add(repoId);
    if (typeof revision !== "string" || revision === "") {
      return jsonError(422, "invalid_field", "缺少 revision。");
    }
    if (
      typeof order !== "number" ||
      !Number.isInteger(order) ||
      order < ADMIN.orderMin ||
      order > ADMIN.orderMax
    ) {
      return jsonError(
        422,
        "invalid_field",
        "order 必须是 0..1000000 的整数。"
      );
    }
    normalized.push({ repoId, revision, order });
  }

  const results: {
    repoId: string;
    ok: boolean;
    code?: string;
    revision?: string;
  }[] = [];
  for (const item of normalized) {
    const before = await runtime.control.getSettings(item.repoId);
    if (!before || before.revision !== item.revision) {
      results.push({
        repoId: item.repoId,
        ok: false,
        code: "revision_conflict",
      });
      continue;
    }
    const saved = await runtime.control.putSettings(
      item.repoId,
      {
        schemaVersion: 1,
        repoId: item.repoId,
        visible: before.visible,
        featured: before.featured,
        order: item.order,
        acknowledgedIncidentId: before.acknowledgedIncidentId,
        updatedBy: identity.email,
      },
      item.revision
    );
    if (saved) {
      results.push({ repoId: item.repoId, ok: true, revision: saved.revision });
      const audit: AuditEntry = {
        schemaVersion: 1,
        at: new Date().toISOString(),
        actor: identity.email,
        repoId: item.repoId,
        action: "reorder",
        before: { order: before.order },
        after: { order: saved.order },
      };
      await runtime.control.appendAudit(audit);
    } else {
      results.push({
        repoId: item.repoId,
        ok: false,
        code: "revision_conflict",
      });
    }
  }

  const failed = results.filter(r => !r.ok);
  return jsonOk({ results, allSucceeded: failed.length === 0 });
};
