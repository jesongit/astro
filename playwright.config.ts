import { defineConfig, devices } from "@playwright/test";

/**
 * 端到端验收(计划 §13.4 test:e2e / §17):
 * 在隔离环境(本地 preview)运行;不使用生产 KV/token。
 * 运行前需 `pnpm run build` 并安装浏览器:`pnpm exec playwright install`。
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:8321",
    ...devices["Desktop Chrome"],
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npx wrangler pages dev dist --port 8321",
        url: "http://127.0.0.1:8321",
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
