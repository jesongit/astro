import type { APIRoute } from "astro";
import { jsonError, jsonOk } from "@/lib/admin/api";

export const prerender = false;

/** GET /api/admin: protected health/root response for the admin namespace. */
export const GET: APIRoute = async context => {
  if (!context.locals.adminIdentity) {
    return jsonError(401, "unauthenticated", "未通过管理鉴权。");
  }
  return jsonOk({ ok: true, service: "admin" });
};
