/**
 * 首页最新文章的构建期快照类型(计划 §11.1)。
 *
 * 为什么不直接在 SSR 首页调用 getCollection:workerd 运行时无法加载
 * astro:content 的 Content Layer 运行时(其 rolldown CJS 垫片在模块初始化时
 * 执行 createRequire(import.meta.url),workerd 下 import.meta.url 为 undefined
 * 直接抛 TypeError)。因此首页改为读取一个预渲染的 JSON 快照:
 * 构建期在 Node 里生成,运行时经 Pages 自带的 ASSETS binding 取回,
 * 保持"一次构建注入一个固定时点"的语义(SITE_BUILD_TIME 由 postFilter 使用)。
 */
export interface PostSnapshot {
  id: string;
  filePath: string | undefined;
  data: {
    title: string;
    description: string;
    pubDatetime: string;
    modDatetime: string | null;
    featured: boolean;
    tags: string[];
  };
}
