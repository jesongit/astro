import type { APIRoute } from "astro";
import {
  adminIntegrationError,
  adminRuntime,
  adminSettings,
  jsonError,
  jsonOk,
  notConfigured,
} from "@/lib/admin/api";
import type { SourceObservation } from "@/lib/portfolio/types";
import { settingsEntry, settingsRevision } from "@/lib/admin/settings";
import sourcesSnapshot from "../../../../../data/portfolio/sources.json";

export const prerender = false;

interface RepoSummary {
  repoId: string;
  fullName: string;
  visible: boolean;
  featured: boolean;
  order: number | null;
  mode: string;
  configState: string;
  releaseState: string;
  eligibility: string;
  lastPublicVerifiedAt: string | null;
  lastContentSuccessAt: string | null;
  warnings: string[];
  revision: string;
}

/**
 * GET /api/admin/repos?cursor=&q=&status=(计划 §10.2):
 * 候选列表 = 最新完整清单 + 人工设置 + 最新观察摘要。
 * 隐藏/异常状态仅管理端可见;分页 cursor 为内存分页偏移。
 */
export const GET: APIRoute = async context => {
  const runtime = adminRuntime(context.locals);
  if (!runtime) return notConfigured();

  const url = new URL(context.request.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const status = url.searchParams.get("status") ?? "all";
  const start = Number(url.searchParams.get("cursor") ?? 0) || 0;

  // GitHub files are authoritative in the new deployment. The checked-in
  // sources snapshot already contains the complete paginated candidate list;
  // the admin request must not re-enumerate GitHub or read KV.
  if (runtime.github) {
    return listFromCheckedInSources(runtime, q, status, start);
  }
  if (!runtime.cache) return notConfigured();

  const inventory = await runtime.cache.getLatestInventory();
  if (!inventory) {
    return jsonOk({
      repos: [],
      cursor: null,
      inventoryComplete: false,
      inventoryObservedAt: null,
    });
  }

  const pageSize = 100;
  const all: RepoSummary[] = [];
  const repoIds = inventory.repos.map(entry => entry.repoId);
  const backend = adminSettings(runtime);
  if (!backend) {
    return jsonError(503, "settings_unconfigured", "GitHub 设置存储未配置。");
  }
  let settingsSnapshot;
  try {
    settingsSnapshot = await backend.read();
  } catch (error) {
    return adminIntegrationError(error);
  }
  const observationsByRepo = await runtime.cache.getLatestObservations(repoIds);
  for (const entry of inventory.repos) {
    const settings = settingsEntry(settingsSnapshot, entry.repoId);
    const observation: SourceObservation | null =
      observationsByRepo.get(entry.repoId) ?? null;
    all.push({
      repoId: entry.repoId,
      fullName: entry.fullName,
      visible: settings?.visible ?? false,
      featured: settings?.featured ?? false,
      order: settings?.order ?? null,
      mode: observation?.mode ?? "basic",
      configState: observation?.configState ?? "absent",
      releaseState: observation?.releaseState ?? "none",
      eligibility: observation?.eligibility ?? "unknown",
      lastPublicVerifiedAt: observation?.lastPublicVerifiedAt ?? null,
      lastContentSuccessAt: observation?.lastContentSuccessAt ?? null,
      warnings: observation?.warnings ?? [],
      revision: settingsRevision(settingsSnapshot, entry.repoId),
    });
  }

  let filtered = all;
  if (q) {
    filtered = filtered.filter(
      r => r.fullName.toLowerCase().includes(q) || r.repoId === q
    );
  }
  if (status === "visible") filtered = filtered.filter(r => r.visible);
  if (status === "hidden") filtered = filtered.filter(r => !r.visible);
  if (status === "featured") filtered = filtered.filter(r => r.featured);
  if (status === "enhanced")
    filtered = filtered.filter(r => r.mode === "enhanced");
  if (status === "config_error")
    filtered = filtered.filter(r => r.configState === "invalid");
  if (status === "sync_error")
    filtered = filtered.filter(
      r =>
        r.eligibility === "unknown" ||
        r.releaseState === "error" ||
        r.warnings.length > 0
    );

  const page = filtered.slice(start, start + pageSize);
  const nextCursor =
    start + pageSize < filtered.length ? String(start + pageSize) : null;

  return jsonOk({
    repos: page,
    cursor: nextCursor,
    inventoryComplete: inventory.completed,
    inventoryObservedAt: inventory.observedAt,
    settingsSource: settingsSnapshot.source,
    settingsSha: settingsSnapshot.sha,
  });
};

async function listFromCheckedInSources(
  runtime: NonNullable<ReturnType<typeof adminRuntime>>,
  q: string,
  status: string,
  start: number
): Promise<Response> {
  const backend = adminSettings(runtime);
  if (!backend) {
    return jsonError(503, "settings_unconfigured", "GitHub 设置存储未配置。");
  }
  try {
    const snapshot = await backend.read();
    const sources = Array.isArray(sourcesSnapshot.sources)
      ? (sourcesSnapshot.sources as Array<Record<string, unknown>>)
      : [];
    let all: RepoSummary[] = sources.flatMap(source => {
      const repoId = typeof source.repoId === "string" ? source.repoId : "";
      const fullName =
        typeof source.fullName === "string" ? source.fullName : "";
      if (!/^\d{1,12}$/.test(repoId) || !fullName) return [];
      const setting = settingsEntry(snapshot, repoId);
      return [
        {
          repoId,
          fullName,
          visible: setting?.visible ?? false,
          featured: setting?.featured ?? false,
          order: setting?.order ?? null,
          mode: typeof source.mode === "string" ? source.mode : "basic",
          configState:
            typeof source.configState === "string"
              ? source.configState
              : "absent",
          releaseState:
            typeof source.releaseState === "string"
              ? source.releaseState
              : "none",
          eligibility:
            typeof source.eligibility === "string"
              ? source.eligibility
              : "unknown",
          lastPublicVerifiedAt:
            typeof source.lastPublicVerifiedAt === "string"
              ? source.lastPublicVerifiedAt
              : null,
          lastContentSuccessAt:
            typeof source.lastContentSuccessAt === "string"
              ? source.lastContentSuccessAt
              : null,
          warnings: Array.isArray(source.warnings)
            ? (source.warnings.filter(
                item => typeof item === "string"
              ) as string[])
            : [],
          revision: settingsRevision(snapshot, repoId),
        },
      ];
    });
    all.sort((a, b) =>
      a.repoId.localeCompare(b.repoId, undefined, { numeric: true })
    );
    if (q)
      all = all.filter(
        item => item.fullName.toLowerCase().includes(q) || item.repoId === q
      );
    if (status === "visible") all = all.filter(item => item.visible);
    if (status === "hidden") all = all.filter(item => !item.visible);
    if (status === "featured") all = all.filter(item => item.featured);
    if (status === "enhanced")
      all = all.filter(item => item.mode === "enhanced");
    if (status === "config_error")
      all = all.filter(item => item.configState === "invalid");
    if (status === "sync_error")
      all = all.filter(
        item =>
          item.eligibility === "unknown" ||
          item.releaseState === "error" ||
          item.warnings.length > 0
      );
    const page = all.slice(start, start + 100);
    return jsonOk({
      repos: page,
      cursor: start + 100 < all.length ? String(start + 100) : null,
      inventoryComplete: true,
      inventoryObservedAt: null,
      settingsSource: snapshot.source,
      settingsSha: snapshot.sha,
    });
  } catch (error) {
    return adminIntegrationError(error);
  }
}
