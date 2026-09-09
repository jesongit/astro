/**
 * 稳定地址(计划 §9.1):公开 canonical 为 /projects/gh-<GitHub 数字 ID>/。
 * slug 系统推导,不接受 AI 配置或管理页修改;解析只认数字 ID。
 */

const SLUG_PATTERN = /^gh-(\d{1,12})$/;

export const projectIdToSlug = (repoId: string): string => {
  if (!/^\d{1,12}$/.test(repoId)) {
    throw new Error(`Invalid GitHub repo id: ${repoId}`);
  }
  return `gh-${repoId}`;
};

/** 解析 slug 中的数字 ID;不合法返回 null(调用方按真实 404 处理) */
export const projectIdFromSlug = (slug: string): string | null => {
  const match = SLUG_PATTERN.exec(slug);
  return match ? match[1] : null;
};

export const isProjectSlug = (slug: string): boolean => SLUG_PATTERN.test(slug);

/** 规范尾斜线路径 */
export const projectPath = (repoId: string): string =>
  `/projects/${projectIdToSlug(repoId)}/`;
