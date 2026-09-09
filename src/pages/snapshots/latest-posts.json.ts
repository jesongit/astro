/**
 * 首页文章快照端点(构建期预渲染,计划 §11.1):
 * 在 Node 构建环境里调用 getCollection 并序列化,产出
 * /snapshots/latest-posts.json;SSR 首页经 ASSETS binding 读取,
 * 避免在 workerd 中加载 astro:content 运行时(见 postsSnapshot.ts 说明)。
 * 快照包含已过 postFilter 的文章,即草稿/定时文章不会出现在此 JSON。
 */
import { getCollection } from "astro:content";
import getSortedPosts from "@/utils/getSortedPosts";
import type { PostSnapshot } from "@/utils/postsSnapshot";

export const prerender = true;

export async function GET(): Promise<Response> {
  const sorted = getSortedPosts(await getCollection("blog"));
  const payload: PostSnapshot[] = sorted.map(({ id, filePath, data }) => ({
    id,
    filePath,
    data: {
      title: data.title,
      description: data.description,
      pubDatetime: data.pubDatetime.toISOString(),
      modDatetime: data.modDatetime ? data.modDatetime.toISOString() : null,
      featured: data.featured ?? false,
      tags: data.tags,
    },
  }));

  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // 构建期产物:文件名固定,内容随部署变化,可安全缓存
      "Cache-Control": "public, max-age=3600",
    },
  });
}
