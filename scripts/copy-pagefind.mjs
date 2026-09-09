#!/usr/bin/env node
/**
 * 构建后把 Pagefind 索引从 dist/pagefind 复制到 public/pagefind,
 * 供 `astro dev` 使用(计划 §2.3 / §13.4)。
 *
 * 取代原先的 `cp -r`:明确清理旧目录、兼容 Windows、失败即退出非零。
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "dist", "pagefind");
const dest = resolve(root, "public", "pagefind");

if (!existsSync(src)) {
  console.error(
    `[copy-pagefind] 未找到 ${src}。请先运行 "pagefind --site dist"。`
  );
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-pagefind] ${src} -> ${dest}`);
