/**
 * 博客内容目录常量。
 *
 * 注意:不要从 content.config.ts 再导出此常量给运行时代码使用——
 * content.config 引用 astro:content 与 astro/loaders(含 Node 侧 fs),
 * 进入 workerd 运行时的模块图会导致 SSR 启动失败
 * (createRequire(import.meta.url) 垫片在 workerd 下不可用)。
 */
export const BLOG_PATH = "src/data/blog";
