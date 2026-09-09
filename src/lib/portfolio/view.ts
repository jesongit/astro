/**
 * 公开视图层(计划 §5 阶段5任务1):所有页面仅使用 PublicProject,
 * 读取路径统一经过发布门禁;KV 不可用时返回空集(页面显示空状态)。
 */
import { ControlStore, PublicCacheStore, type PortfolioKV } from "./store";
import {
  comparePortfolioPriority,
  normalizeDisplaySettings,
} from "./data-model";
import { evaluatePublication, toPublicProject } from "./publication";
import { projectIdFromSlug } from "./slug";
import { ADMIN } from "./config";
import type { PublicProject } from "./types";

interface LocalsLike {
  runtime?: { env: Partial<Record<string, unknown>> };
}

function storesFrom(locals: LocalsLike | undefined): {
  control: ControlStore;
  cache: PublicCacheStore;
} | null {
  const env = locals?.runtime?.env ?? {};
  const control = env.PORTFOLIO_CONTROL as PortfolioKV | undefined;
  const cache = env.PORTFOLIO_CACHE as PortfolioKV | undefined;
  if (
    !control ||
    !cache ||
    typeof control.get !== "function" ||
    typeof cache.get !== "function"
  ) {
    return null;
  }
  return {
    control: new ControlStore(control),
    cache: new PublicCacheStore(cache),
  };
}

const byManualOrder = (
  a: DisplaySettingsLike,
  b: DisplaySettingsLike
): number =>
  comparePortfolioPriority(
    normalizeDisplaySettings(a.repoId, a),
    normalizeDisplaySettings(b.repoId, b)
  );

interface DisplaySettingsLike {
  repoId: string;
  visible: boolean;
  featured: boolean;
  order: number;
}

/**
 * 已发布作品(按人工顺序)。KV 不可用/无内容 → 空数组;
 * 单个作品 payload 缺失(缓存未传播)跳过该卡片,不合成内容(§8.3)。
 */
export async function listPublicProjects(
  locals: LocalsLike | undefined,
  options: { featuredOnly?: boolean; limit?: number } = {}
): Promise<PublicProject[]> {
  const stores = storesFrom(locals);
  if (!stores) return [];
  const { control, cache } = stores;

  const settings = (await control.listAllSettings())
    .filter(s => s.visible && (!options.featuredOnly || s.featured))
    .sort(byManualOrder)
    .slice(0, options.limit ?? ADMIN.projectsPerPage * 100);

  const out: PublicProject[] = [];
  const now = Date.now();
  for (const setting of settings) {
    const observation = await cache.getLatestObservation(setting.repoId);
    const incidents = await cache.getIncidents(setting.repoId);
    const verdict = evaluatePublication({
      settings: setting,
      observation,
      incidents,
      now,
    });
    if (!verdict.publishable || !observation?.payloadHash) continue;
    const content = await cache.getPayload(observation.payloadHash);
    const project = toPublicProject(observation, content);
    if (project) out.push(project);
  }
  return out;
}

/** 详情读取(计划 §9.2/§17):
 * - slug 不合法 / 门禁拒绝(不存在、撤下、资格过期)→ not_found(真实 404);
 * - 绑定缺失或 payload 未传播(缓存未一致)→ unavailable(503 + Retry-After);
 * - 页面请求不直接调用 GitHub,不合成内容。
 */
export type ProjectLookup =
  | { ok: true; project: PublicProject }
  | { ok: false; reason: "not_found" | "unavailable" };

export async function lookupPublicProject(
  locals: LocalsLike | undefined,
  slug: string
): Promise<ProjectLookup> {
  const repoId = projectIdFromSlug(slug);
  if (!repoId) return { ok: false, reason: "not_found" };
  const stores = storesFrom(locals);
  if (!stores) return { ok: false, reason: "unavailable" };
  const { control, cache } = stores;

  const settings = await control.getSettings(repoId);
  const observation = await cache.getLatestObservation(repoId);
  const incidents = await cache.getIncidents(repoId);
  const verdict = evaluatePublication({
    settings,
    observation,
    incidents,
    now: Date.now(),
  });
  if (!verdict.publishable) return { ok: false, reason: "not_found" };
  if (!settings || !observation) return { ok: false, reason: "not_found" };
  const content = observation.payloadHash
    ? await cache.getPayload(observation.payloadHash)
    : null;
  const project = toPublicProject(observation, content);
  if (!project) return { ok: false, reason: "unavailable" };
  return { ok: true, project };
}
