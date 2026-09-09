/**
 * 池化冒烟测试专用入口:刻意不引入任何业务模块(避免 ajv 等 CJS
 * 依赖进入 workerd 转换路径;调度逻辑已在 Node 侧覆盖)。
 * 仅用于验证真实 KV API 形状与 Worker fetch 入口行为。
 */
export default {
  async fetch(): Promise<Response> {
    return new Response("Not Found", { status: 404 });
  },
};
