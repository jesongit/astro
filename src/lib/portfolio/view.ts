/**
 * 作品公开视图层。
 *
 * 公开请求读取 Actions 构建提交的静态作品快照；它们不携带运行时凭据，
 * 也不会触发 GitHub 请求或 KV List。所有公开入口仍统一经过
 * `createSnapshotView` 中的发布门禁。
 */
import { defaultSnapshotView } from "./snapshot";
import type { PublicProject } from "./types";

interface LocalsLike {
  /** 保留参数形状，兼容 Astro 页面和现有调用方；公开视图不读取它。 */
  runtime?: { env: Partial<Record<string, unknown>> };
}

/**
 * 已发布作品(按构建时保存的人工顺序)。
 *
 * `locals` 只为保持路由调用契约保留；作品数据来自构建生成的
 * `data/portfolio/settings.json`、`sources.json` 和 `projects.json`。
 */
export async function listPublicProjects(
  _locals: LocalsLike | undefined,
  options: { featuredOnly?: boolean; limit?: number } = {}
): Promise<PublicProject[]> {
  void _locals;
  return defaultSnapshotView.listPublicProjects(options);
}

/** 搜索专用内部投影：正文纯文本不进入公开项目 JSON，仅供站内排序。 */
export async function listPublicProjectSearchRecords(
  _locals: LocalsLike | undefined
): Promise<{ project: PublicProject; bodyTextPlain: string }[]> {
  void _locals;
  return defaultSnapshotView.listPublicSearchRecords();
}

/** 详情读取：slug 不合法或发布门禁拒绝时返回 not_found。 */
export type ProjectLookup =
  | { ok: true; project: PublicProject }
  | { ok: false; reason: "not_found" | "unavailable" };

export async function lookupPublicProject(
  _locals: LocalsLike | undefined,
  slug: string
): Promise<ProjectLookup> {
  void _locals;
  return defaultSnapshotView.lookupPublicProject(slug);
}
