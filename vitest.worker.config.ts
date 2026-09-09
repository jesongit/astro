import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

/**
 * Worker 集成测试(计划 §17):
 * 真实 KV API 形状(workerd 本地模拟)+ 注入 scheduled 事件 + 假 GitHub 响应。
 * 不使用真实 token 或生产 KV。
 */
export default defineWorkersConfig({
  test: {
    include: ["tests/worker/**/*.test.ts"],
    server: {
      deps: {
        // ajv/ajv-formats 为 CJS 包,需要 vite 内联转换后进入 workerd
        inline: [
          "ajv",
          "ajv-formats",
          "fast-deep-equal",
          "json-schema-traverse",
          "uri-js",
        ],
      },
    },
    poolOptions: {
      workers: {
        wrangler: { configPath: "./tests/worker/wrangler.test.jsonc" },
      },
    },
  },
});
