import type { APIRoute } from "astro";
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
import type { AuditEntry } from "@/lib/portfolio/types";

export const prerender = false;

const ALLOWED_KEYS = ["items"] as const;
const ITEM_KEYS = new Set(["repoId", "revision", "order"]);

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
  const backend = adminSettings(runtime);
  if (!backend) {
    return jsonError(503, "settings_unconfigured", "GitHub 设置存储未配置。");
  }

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
    const unknown = Object.keys(item).filter(key => !ITEM_KEYS.has(key));
    if (unknown.length > 0) {
      return jsonError(422, "unknown_fields", "存在不允许的排序字段。", {
        fieldErrors: unknown.map(path => ({
          path: `items.${path}`,
          message: "未知字段",
        })),
      });
    }
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

  const inventory = await runtime.cache.getLatestInventory();
  if (inventory) {
    const knownRepoIds = new Set(inventory.repos.map(repo => repo.repoId));
    const unknownRepo = normalized.find(item => !knownRepoIds.has(item.repoId));
    if (unknownRepo) {
      return jsonError(404, "unknown_repo", "仓库不在当前候选清单中。");
    }
  }

  // Keep the old per-record behavior only for the explicit compatibility
  // fallback. A configured GitHub backend must use one file SHA and one
  // atomic Contents commit below.
  if (backend.source === "kv-compat" && runtime.control) {
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
      if (!saved) {
        results.push({
          repoId: item.repoId,
          ok: false,
          code: "revision_conflict",
        });
        continue;
      }
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
    }
    return jsonOk({
      results,
      allSucceeded: results.every(result => result.ok),
      source: "kv-compat",
      committed: results.some(result => result.ok),
    });
  }

  const revisions = new Set(normalized.map(item => item.revision));
  if (revisions.size !== 1) {
    return jsonError(
      409,
      "settings_conflict",
      "批量排序必须基于同一个设置文件版本。"
    );
  }
  try {
    const saved = await backend.save(
      Object.fromEntries(
        normalized.map(item => [item.repoId, { order: item.order }])
      ),
      normalized[0]!.revision,
      identity.email
    );
    const results = normalized.map(item => ({
      repoId: item.repoId,
      ok:
        saved.changedRepoIds.includes(item.repoId) ||
        saved.unchangedRepoIds.includes(item.repoId),
      revision: saved.revisions[item.repoId] ?? saved.sha ?? "",
    }));
    return jsonOk({
      results,
      allSucceeded: true,
      source: saved.source,
      committed: saved.committed,
      sha: saved.sha,
      commitSha: saved.commitSha,
    });
  } catch (error) {
    return adminIntegrationError(error);
  }
};
