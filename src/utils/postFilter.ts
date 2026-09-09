import type { CollectionEntry } from "astro:content";
import { SITE } from "@/config";

/**
 * 文章发布资格的统一过滤入口(计划 §2.3):
 * - `draft: true` 或位于 `_drafts/` 目录(含子目录)一律视为未发布;
 *   仅凭文件名 glob 不足以排除 _drafts 的后代,因此叠加路径判断;
 * - 生产环境使用一次构建注入的 SITE_BUILD_TIME 判断定时发布,
 *   静态页面与 SSR 首页共享同一时点(计划 §11.1);
 * - 开发模式保留实时预览行为。
 *
 * 所有发布面(列表/详情/RSS/OG/归档)都必须经过本入口。
 */
const isDraftFile = (filePath?: string) =>
  !!filePath && filePath.split(/[\\/]/).includes("_drafts");

const postFilter = ({ data, filePath }: CollectionEntry<"blog">) => {
  const now = import.meta.env.DEV ? Date.now() : SITE_BUILD_TIME;
  const isPublishTimePassed =
    now > new Date(data.pubDatetime).getTime() - SITE.scheduledPostMargin;
  return (
    data.draft !== true &&
    !isDraftFile(filePath) &&
    (import.meta.env.DEV || isPublishTimePassed)
  );
};

export default postFilter;
