// 最终验证脚本(本地验收用):按 CI 顺序执行,任何一步失败即退出非零。
import { spawnSync } from "node:child_process";

const steps = [
  ["astro check", ["exec", "astro", "check"]],
  ["vitest (logic/worker-logic/auth)", ["exec", "vitest", "run"]],
  ["format:check", ["run", "format:check"]],
  ["astro build", ["exec", "astro", "build"]],
  ["pagefind", ["exec", "pagefind", "--site", "dist"]],
  ["check:artifact", ["run", "check:artifact"]],
  ["check:routes", ["run", "check:routes"]],
];

let failed = false;
for (const [name, args] of steps) {
  process.stdout.write(`\n=== ${name} ===\n`);
  const result = spawnSync("pnpm", args, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error(`\n*** 步骤失败: ${name} ***\n`);
    failed = true;
    break;
  }
}

console.log(failed ? "\n=== 验证失败 ===" : "\n=== 全部验证通过 ===");
process.exit(failed ? 1 : 0);
