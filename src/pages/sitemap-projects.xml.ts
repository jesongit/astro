import type { APIRoute } from "astro";
import { listPublicProjects } from "@/lib/portfolio/view";

export const prerender = false;

/**
 * 动态作品 sitemap(计划 §12.1):
 * 只列当前通过发布门禁的作品;lastmod 取内容变化/真实 Release 更新时间。
 * 无法可靠计算时保持无 lastmod,不用空 sitemap 冒充全部被删除。
 * middleware 对本路由设置 no-store。
 */
export const GET: APIRoute = async ({ locals, site }) => {
  const projects = await listPublicProjects(locals as never);
  const base = site ?? new URL("https://example.com");

  const nowIso = new Date().toISOString();
  const urls = [
    { loc: `${base.origin}/projects/`, lastmod: nowIso },
    ...projects.map(p => ({
      loc: `${base.origin}/projects/${p.slug}/`,
      lastmod: p.release?.publishedAt || undefined,
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    u =>
      `  <url>\n    <loc>${u.loc}</loc>${
        u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""
      }\n  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
