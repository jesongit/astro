import type { APIRoute } from "astro";
import { listPublicProjects } from "@/lib/portfolio/view";

export const prerender = false;

/**
 * GET /api/projects(计划 §11.2/§12):公开投影 JSON。
 * 仅白名单字段,经发布门禁;无 KV 原始对象、管理状态或内部错误。
 */
export const GET: APIRoute = async ({ locals }) => {
  const projects = await listPublicProjects(locals as never);
  return new Response(JSON.stringify({ projects }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
