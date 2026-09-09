import type { APIRoute } from "astro";
import { LIMITS } from "@/lib/portfolio/config";
import { isValidQuery, searchProjects } from "@/lib/portfolio/search";
import { listPublicProjects } from "@/lib/portfolio/view";

export const prerender = false;

/**
 * GET /api/projects/search?q=(计划 §12.2):
 * 服务器端搜索已发布作品;q 长度 2–80,最多 20 项,固定预算。
 * 不返回未展示、失效资格或未确认恢复的作品。
 */
export const GET: APIRoute = async ({ locals, url }) => {
  const q = (url.searchParams.get("q") ?? "").slice(
    0,
    LIMITS.searchQueryMax + 16
  );
  if (!isValidQuery(q)) {
    return new Response(JSON.stringify({ query: q, results: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const projects = await listPublicProjects(locals as never);
  const records = projects.map((p, index) => ({
    slug: p.slug,
    href: `/projects/${p.slug}/`,
    title: p.title,
    summary: p.summary,
    topics: p.topics,
    techStack: p.techStack,
    bodyText: (p.bodyHtml ?? "").slice(0, 4000),
    order: index, // listPublicProjects 已按人工 order 升序;同分保持该顺序
  }));
  // 人工顺序:view.listPublicProjects 已按 order 升序返回,搜索同分按该顺序稳定排序
  const results = searchProjects(records, q).map(r => ({
    slug: r.slug,
    href: r.href,
    title: r.title,
    summary: r.summary,
    topics: r.topics.slice(0, 4),
  }));

  return new Response(JSON.stringify({ query: q, results }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
