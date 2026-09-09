import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * 纯逻辑测试(协议/归一化/门禁/搜索/识别):
 * 不依赖 Workers 运行时;Worker 集成测试见 vitest.worker.config.ts。
 */
export default defineConfig({
  test: {
    include: ["tests/portfolio/**/*.test.ts", "tests/lib/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
