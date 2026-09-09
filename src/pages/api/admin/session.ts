import type { APIRoute } from "astro";
import { createCsrfToken } from "@/lib/auth/csrf";
import { jsonError, jsonOk } from "@/lib/admin/api";

export const prerender = false;

/** GET /api/admin/session:已验证身份 + 短时 CSRF token + 服务器时间(§10.2) */
export const GET: APIRoute = async context => {
  const identity = context.locals.adminIdentity;
  if (!identity) {
    return jsonError(401, "unauthenticated", "未通过管理鉴权。");
  }
  const env = (context.locals.runtime?.env ?? {}) as Record<
    string,
    string | undefined
  >;
  const csrfSecret = env.CSRF_SECRET ?? "";
  if (!csrfSecret) {
    return jsonError(503, "csrf_unconfigured", "CSRF 未配置,失败关闭。");
  }
  const host = (
    context.request.headers.get("Host") ?? context.url.host
  ).toLowerCase();
  const origin = `https://${host}`;
  const { token, expiresAt } = await createCsrfToken(csrfSecret, {
    sub: identity.sub,
    origin,
  });
  return jsonOk({
    email: identity.email,
    csrfToken: token,
    csrfExpiresAt: expiresAt,
    serverTime: new Date().toISOString(),
  });
};
