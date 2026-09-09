#!/usr/bin/env node
/**
 * 读取本地 .env.cloudflare 凭据并执行 Cloudflare 命令(凭据不回显、不入库)。
 *
 * 用法:
 *   node scripts/cf.mjs <command...>            以 .env.cloudflare 环境运行命令(如 npx wrangler ...)
 *   node scripts/cf.mjs api <METHOD> <path> [body.json]
 *                                               调用 Cloudflare API v4(path 不含 /client/v4 前缀;
 *                                               body.json 为可选请求体文件)
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const env = { ...process.env };
for (const line of readFileSync(
  new URL("../.env.cloudflare", import.meta.url),
  "utf8"
).split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

if (!env.CLOUDFLARE_API_TOKEN) {
  console.error("缺少 CLOUDFLARE_API_TOKEN,请先配置 .env.cloudflare");
  process.exit(1);
}

const [, , first, ...rest] = process.argv;

if (first === "api") {
  const [method, path, bodyFile] = rest;
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method: method.toUpperCase(),
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: bodyFile ? readFileSync(bodyFile, "utf8") : undefined,
  });
  const payload = await response.text();
  try {
    console.log(JSON.stringify(JSON.parse(payload), null, 2));
  } catch {
    console.log(payload);
  }
  process.exitCode = response.ok ? 0 : 1;
} else if (first) {
  const r = spawnSync(first, rest, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });
  process.exitCode = r.status;
} else {
  console.error(
    "用法: node scripts/cf.mjs <command...> | api <METHOD> <path> [body.json]"
  );
  process.exit(1);
}
