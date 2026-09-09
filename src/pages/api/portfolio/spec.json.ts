import type { APIRoute } from "astro";
import { SITE } from "@/config";
import { buildSpec } from "@/lib/portfolio/protocol";

/**
 * GET /api/portfolio/spec.json(计划 §6.1):
 * 公开内容规范目录;构建期静态生成,无需访问 KV,支持 GET/HEAD。
 * 这组公开规范允许 * CORS(不携带凭据);管理 API 不复制此行为。
 */
const prerender = true;

const GET: APIRoute = async ({ request }) => {
  const body = JSON.stringify(buildSpec(SITE.website));
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
    "Access-Control-Allow-Origin": "*",
  });
  if (request.method === "HEAD") {
    headers.set(
      "Content-Length",
      String(new TextEncoder().encode(body).length)
    );
    return new Response(null, { status: 200, headers });
  }
  return new Response(body, { status: 200, headers });
};

const HEAD: APIRoute = GET;

export { prerender, GET, HEAD };
