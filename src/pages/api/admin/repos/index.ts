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
