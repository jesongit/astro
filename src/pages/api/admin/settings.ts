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
import { settingsEntry } from "@/lib/admin/settings";
import type { SettingsPatch } from "@/lib/admin/github";

export const prerender = false;

const ALLOWED_KEYS = [
  "patch",
  "items",
  "sha",
  "revision",
  "baseSha",
  "expectedSha",
] as const;
const PATCH_KEYS = new Set([
  "visible",
  "featured",
  "order",
  "acknowledgedIncidentId",
]);
const ITEM_KEYS = new Set(["repoId", "dirty", ...PATCH_KEYS]);

/** GET /api/admin/settings: current authoritative file and its SHA. */
export const GET: APIRoute = async context => {
  const runtime = adminRuntime(context.locals);
  if (!runtime) return notConfigured();
  if (!context.locals.adminIdentity) {
    return jsonError(401, "unauthenticated", "未通过管理鉴权。");
  }
  const backend = adminSettings(runtime);
  if (!backend) {
    return jsonError(503, "settings_unconfigured", "GitHub 设置存储未配置。");
  }
  try {
    const snapshot = await backend.read();
    return jsonOk(snapshot);
  } catch (error) {
    return adminIntegrationError(error);
  }
};

/**
 * POST/PATCH /api/admin/settings:
 * save all dirty repository entries as one GitHub settings-file commit.
 * `sha` and `revision` are aliases; GitHub's Contents file SHA is the
 * optimistic-concurrency token. An empty SHA is only valid for an initial
 * file/repository save.
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

  const patchResult = parsePatch(parsed.body);
  if (!patchResult.ok) return patchResult.response;
  const patch = patchResult.patch;
  const expectedResult = parseExpectedRevision(parsed.body);
  if (!expectedResult.ok) return expectedResult.response;
  if (Object.keys(patch).length > 0 && !expectedResult.provided) {
    return jsonError(
      400,
      "revision_required",
      "批量保存必须携带设置文件 SHA。"
    );
  }

  let snapshot;
  try {
    snapshot = await backend.read();
  } catch (error) {
    return adminIntegrationError(error);
  }

  for (const [repoId, entry] of Object.entries(patch)) {
    if (entry.visible !== true || entry.acknowledgedIncidentId !== undefined)
      continue;
    const incidents = runtime.cache
      ? await runtime.cache.getIncidents(repoId)
      : [];
    if (incidents.length === 0) continue;
    const latest = incidents.reduce((a, b) =>
      Date.parse(a.observedAt) >= Date.parse(b.observedAt) ? a : b
    );
    if (
      settingsEntry(snapshot, repoId)?.acknowledgedIncidentId !==
      latest.incidentId
    ) {
      return jsonError(
        409,
        "incident_acknowledgement_required",
        "存在未确认的撤下事件,需先确认后才能恢复展示。",
        {
          fieldErrors: [
            {
              path: `patch.${repoId}.acknowledgedIncidentId`,
              message: latest.incidentId,
            },
          ],
        }
      );
    }
  }

  try {
    const saved = await backend.save(
      patch,
      expectedResult.value,
      identity.email
    );
    let publishState = "not_dispatched";
    let publishJobId: string | null = null;
    if (saved.committed && runtime.github) {
      try {
        const dispatched = await runtime.github.dispatchWorkflow({
          kind: "build",
        });
        publishState = "dispatched";
        publishJobId = dispatched.dispatchId;
      } catch {
        publishState = "dispatch_failed";
      }
    }
    return jsonOk({
      source: saved.source,
      committed: saved.committed,
      saveState: saved.committed ? "saved" : "unchanged",
      publishState,
      publishJobId,
      dirty: Object.keys(patch).length > 0,
      changedRepoIds: saved.changedRepoIds,
      unchangedRepoIds: saved.unchangedRepoIds,
      sha: saved.sha,
      commitSha: saved.commitSha,
      settings: saved.settings,
      revisions: saved.revisions,
    });
  } catch (error) {
    return adminIntegrationError(error);
  }
};

export const PATCH = POST;
export const PUT = POST;

function parsePatch(
  body: Record<string, unknown>
): { ok: true; patch: SettingsPatch } | { ok: false; response: Response } {
  if (body.patch !== undefined && body.items !== undefined) {
    return {
      ok: false,
      response: jsonError(
        400,
        "invalid_patch",
        "patch 与 items 不能同时提供。"
      ),
    };
  }
  if (body.patch === undefined && body.items === undefined) {
    return { ok: true, patch: {} };
  }

  const patch: SettingsPatch = {};
  if (body.patch !== undefined) {
    if (
      typeof body.patch !== "object" ||
      body.patch === null ||
      Array.isArray(body.patch)
    ) {
      return {
        ok: false,
        response: jsonError(400, "invalid_patch", "patch 必须是对象。"),
      };
    }
    for (const [repoId, value] of Object.entries(
      body.patch as Record<string, unknown>
    )) {
      const result = parseRepoPatch(repoId, value);
      if (!result.ok) return result;
      patch[repoId] = result.patch;
    }
  } else {
    if (!Array.isArray(body.items)) {
      return {
        ok: false,
        response: jsonError(400, "invalid_items", "items 必须是数组。"),
      };
    }
    if (body.items.length > 500) {
      return {
        ok: false,
        response: jsonError(422, "too_many_items", "单次最多保存 500 个仓库。"),
      };
    }
    const seen = new Set<string>();
    for (const item of body.items) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return {
          ok: false,
          response: jsonError(400, "invalid_items", "items 元素必须是对象。"),
        };
      }
      const record = item as Record<string, unknown>;
      const repoId = record.repoId;
      if (typeof repoId !== "string") {
        return {
          ok: false,
          response: jsonError(422, "invalid_field", "repoId 必须是字符串。"),
        };
      }
      if (seen.has(repoId)) {
        return {
          ok: false,
          response: jsonError(422, "duplicate_repo", `repoId 重复:${repoId}`),
        };
      }
      seen.add(repoId);
      const unknown = Object.keys(record).filter(key => !ITEM_KEYS.has(key));
      if (unknown.length > 0) {
        return {
          ok: false,
          response: jsonError(
            422,
            "unknown_fields",
            "存在不允许的批量设置字段。",
            {
              fieldErrors: unknown.map(path => ({
                path: `items.${path}`,
                message: "未知字段",
              })),
            }
          ),
        };
      }
      if (record.dirty !== undefined && typeof record.dirty !== "boolean") {
        return {
          ok: false,
          response: jsonError(422, "invalid_field", "dirty 必须是布尔值。"),
        };
      }
      if (record.dirty === false) continue;
      const values = { ...record };
      delete values.repoId;
      delete values.dirty;
      const result = parseRepoPatch(repoId, values);
      if (!result.ok) return result;
      patch[repoId] = result.patch;
    }
  }
  return { ok: true, patch };
}

function parseRepoPatch(
  repoId: string,
  value: unknown
):
  | { ok: true; patch: Partial<SettingsPatch[string]> }
  | { ok: false; response: Response } {
  if (!/^\d{1,12}$/.test(repoId)) {
    return {
      ok: false,
      response: jsonError(422, "invalid_field", "repoId 不合法。"),
    };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      ok: false,
      response: jsonError(422, "invalid_field", "仓库设置必须是对象。"),
    };
  }
  const record = value as Record<string, unknown>;
  const unknown = Object.keys(record).filter(key => !PATCH_KEYS.has(key));
  if (unknown.length > 0) {
    return {
      ok: false,
      response: jsonError(422, "unknown_fields", "存在不允许的仓库设置字段。", {
        fieldErrors: unknown.map(path => ({
          path: `patch.${repoId}.${path}`,
          message: "未知字段",
        })),
      }),
    };
  }
  if (record.visible !== undefined && typeof record.visible !== "boolean") {
    return {
      ok: false,
      response: jsonError(422, "invalid_field", "visible 必须是布尔值。"),
    };
  }
  if (record.featured !== undefined && typeof record.featured !== "boolean") {
    return {
      ok: false,
      response: jsonError(422, "invalid_field", "featured 必须是布尔值。"),
    };
  }
  if (
    record.order !== undefined &&
    (typeof record.order !== "number" ||
      !Number.isInteger(record.order) ||
      record.order < 0 ||
      record.order > 1_000_000)
  ) {
    return {
      ok: false,
      response: jsonError(
        422,
        "invalid_field",
        "order 必须是 0..1000000 的整数。"
      ),
    };
  }
  if (
    record.acknowledgedIncidentId !== undefined &&
    record.acknowledgedIncidentId !== null &&
    typeof record.acknowledgedIncidentId !== "string"
  ) {
    return {
      ok: false,
      response: jsonError(
        422,
        "invalid_field",
        "acknowledgedIncidentId 必须是字符串或 null。"
      ),
    };
  }
  return { ok: true, patch: record as Partial<SettingsPatch[string]> };
}

function parseExpectedRevision(
  body: Record<string, unknown>
):
  | { ok: true; value: string | undefined; provided: boolean }
  | { ok: false; response: Response } {
  const values = ["sha", "revision", "baseSha", "expectedSha"]
    .filter(key => body[key] !== undefined)
    .map(key => body[key]);
  if (values.length === 0)
    return { ok: true, value: undefined, provided: false };
  if (values.some(value => typeof value !== "string")) {
    return {
      ok: false,
      response: jsonError(
        400,
        "revision_required",
        "设置文件 SHA 必须是字符串。"
      ),
    };
  }
  const unique = new Set(values as string[]);
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
  return {
    ok: true,
    value: values[0] as string,
    provided: true,
  };
}
