import type { APIRoute } from "astro";

/**
 * robots.txt(计划 §12.1):
 * - 同时声明静态 sitemap-index 与动态 sitemap-projects;
 * - Disallow /admin 与 /api/admin(明确 robots 不是鉴权,鉴权在 middleware)。
 */
const getRobotsTxt = (sitemapURL: URL, projectsSitemapURL: URL) => `
User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/*
Disallow: /api/admin
Disallow: /api/admin/*

Sitemap: ${sitemapURL.href}
Sitemap: ${projectsSitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL("sitemap-index.xml", site);
  const projectsSitemapURL = new URL("sitemap-projects.xml", site);
  return new Response(getRobotsTxt(sitemapURL, projectsSitemapURL));
};
