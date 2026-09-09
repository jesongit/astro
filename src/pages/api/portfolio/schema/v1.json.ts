import type { APIRoute } from "astro";
import schemaJson from "@/lib/portfolio/schema/v1.json";

/**
 * GET /api/portfolio/schema/v1.json(计划 §6.1):
 * 规范性 JSON Schema 原文;Content-Type 为 application/schema+json。
 */
const prerender = true;

const GET: APIRoute = async ({ request }) => {
  const body = JSON.stringify(schemaJson, null, 2);
  const headers = new Headers({
    "Content-Type": "application/schema+json; charset=utf-8",
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
