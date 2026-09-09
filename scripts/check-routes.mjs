#!/usr/bin/env node
/**
 * SSR 路由清单检查(计划 §15 scripts/check-routes.mjs):
 * - 必须被 SSR 覆盖的路径(首页/管理/作品/API/动态 sitemap)必须在 include 中;
 * - 静态路径(文章/标签/归档/RSS/搜索/指南/静态 API)不得被非根 include 覆盖;
 * - include "/" 是 SSR 首页所需(Cloudflare 前缀匹配会让所有请求进 Worker,
 *   未匹配路由由适配器回退到 ASSETS 静态服务),不参与"误覆盖静态路径"判断。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const routes = JSON.parse(
  readFileSync(join(root, "dist", "_routes.json"), "utf8")
);
const includes = (routes.include ?? []).map(String);

const MUST_INCLUDE = [
  "/", // SSR 首页
  "/admin",
  "/api/admin",
  "/api/projects",
  "/projects",
  "/sitemap-projects.xml",
];

const MUST_NOT_INCLUDE = [
  "/posts",
  "/tags",
  "/archives",
  "/rss.xml",
  "/search",
  "/about",
  "/portfolio-guide",
  "/api/portfolio",
];

const failures = [];

// 1. SSR 关键路径必须被覆盖("/" 单独精确要求)
const baseOf = inc => inc.replace(/\*+$/, "").replace(/\/$/, "");
for (const need of MUST_INCLUDE) {
  const covered =
    need === "/"
      ? includes.includes("/")
      : includes.some(inc => {
          if (inc === "/") return false;
          const base = baseOf(inc);
          return need === base || need.startsWith(base);
        });
  if (!covered) failures.push(`include 缺少 SSR 路径 ${need}`);
}

// 2. 静态路径不得被非根 include 覆盖
const nonRootIncludes = includes.filter(inc => inc !== "/");
for (const bad of MUST_NOT_INCLUDE) {
  const covering = nonRootIncludes.filter(
    inc => bad.startsWith(inc) || inc.startsWith(bad)
  );
  if (covering.length > 0) {
    failures.push(`静态路径 ${bad} 被 include 覆盖:${covering.join(", ")}`);
  }
}

if (failures.length > 0) {
  console.error("[check-routes] 失败:");
  for (const f of failures) console.error(`  - ${f}`);
  console.error(`当前 include:${JSON.stringify(includes)}`);
  process.exit(1);
}
console.log("[check-routes] 全部通过");
