#!/usr/bin/env node
/**
 * 构建产物检查(计划 §15 scripts/check-artifact.mjs / §13.4 check:artifact):
 * - 文章 URL 保留、草稿排除(_drafts 后代不得出现);
 * - OG 图片存在;
 * - SSR 路由清单(_routes.json)把 /admin、/api/admin、/projects、/ 交给 Functions;
 * - 管理页/作品页未被静态化;
 * - 客户端 bundle 无 secret/敏感变量。
 * 失败即退出非零。
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const dist = join(root, "dist");
const failures = [];

const check = (ok, message) => {
  if (!ok) failures.push(message);
};

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

// 1. 基础产物存在
check(existsSync(join(dist, "_routes.json")), "缺少 dist/_routes.json");
check(existsSync(join(dist, "_worker.js")), "缺少 dist/_worker.js");
check(existsSync(join(dist, "og.png")), "缺少 OG 图片 dist/og.png");
check(existsSync(join(dist, "pagefind", "pagefind.js")), "缺少 Pagefind 索引");

// 2. 草稿排除:任何 _drafts 内容不得进入产物
const draftLeak = walk(dist).filter(f => f.includes("_drafts"));
check(
  draftLeak.length === 0,
  `_drafts 内容泄漏进产物:${draftLeak.slice(0, 3).join(", ")}`
);

// 3. 管理页不得静态化
check(
  !existsSync(join(dist, "admin", "index.html")),
  "/admin 被静态化,绕过了管理鉴权"
);
check(
  !existsSync(join(dist, "projects", "index.html")),
  "/projects 被静态化(应为 SSR)"
);

// 4. 已有文章 URL 抽样保留(§14.1 已发布 URL 保留)
const samplePost = join(dist, "posts", "notes", "git-cheatsheet", "index.html");
check(existsSync(samplePost), "既有文章 URL 丢失:posts/notes/git-cheatsheet/");

// 5. _routes.json 必须覆盖管理/作品/首页动态路由
const routes = JSON.parse(readFileSync(join(dist, "_routes.json"), "utf8"));
const includes = JSON.stringify(routes.include ?? []);
for (const need of [
  "/admin",
  "/api/admin",
  "/projects",
  "/api/projects",
  "/sitemap-projects.xml",
]) {
  check(
    includes.includes(need),
    `_routes.json include 缺少 ${need}(会被静态服务绕过 SSR 鉴权/门禁)`
  );
}

// 6. 客户端 bundle 与页面源码无 secret
const SECRET_PATTERNS = [
  [/GITHUB_TOKEN\s*[:=]\s*["'][^"']{8,}/, "GITHUB_TOKEN 字面量"],
  [/CSRF_SECRET\s*[:=]\s*["'][^"']{8,}/, "CSRF_SECRET 字面量"],
  [/ghp_[A-Za-z0-9]{20,}/, "GitHub PAT 形态 token"],
  [/ACCESS_AUD\s*[:=]\s*["'][a-f0-9]{16,}\.access/, "Access audience 字面量"],
];
for (const file of walk(dist)) {
  if (!/\.(js|mjs|html|json)$/.test(file)) continue;
  const content = readFileSync(file, "utf8");
  for (const [pattern, label] of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      failures.push(`疑似 secret 泄漏(${label}):${file.replace(dist, "dist")}`);
    }
  }
}

// 7. 管理接口不得出现在公开页面的链接中
const homeHtml = existsSync(join(dist, "index.html"))
  ? readFileSync(join(dist, "index.html"), "utf8")
  : "";
check(!homeHtml.includes("/api/admin"), "公开首页出现 /api/admin 链接");

if (failures.length > 0) {
  console.error("[check-artifact] 失败:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("[check-artifact] 全部通过");
