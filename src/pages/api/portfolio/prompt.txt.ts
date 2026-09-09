import type { APIRoute } from "astro";
import { SITE } from "@/config";
import { buildPromptText } from "@/lib/portfolio/protocol";

/**
 * GET /api/portfolio/prompt.txt(计划 §6.2):
 * 用户复制到自己项目环境中交给 AI 的提示词,UTF-8 纯文本。
 */
const prerender = true;

const GET: APIRoute = async ({ request }) => {
  const body = buildPromptText(SITE.website);
  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
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
