/**
 * Astro 中间件(计划 §10 / §12.3):
 * - /admin 与 /api/admin:所有方法在渲染/写入前完成 Access JWT 验证;
 *   写请求附加 Origin/Content-Type/CSRF/Sec-Fetch-Site 校验;
 * - 管理响应一律 private,no-store + noindex;
 * - 动态作品路由(首页/作品/API/动态 sitemap)no-store,禁止任何整页缓存;
 * - 公开规范 API 的 * CORS 不复制到管理 API。
 *
 * 没有配置 Access 时对管理路径失败关闭(503),不存在绕过开关。
 */
import { defineMiddleware } from "astro:middleware";
import {
  isAccessConfigured,
  verifyAccessRequest,
  type AccessConfig,
} from "@/lib/auth/access";
import { verifyCsrfToken } from "@/lib/auth/csrf";

interface RuntimeEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  ADMIN_ALLOWED_HOSTS?: string;
  CSRF_SECRET?: string;
}

const CSV = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const json = (status: number, code: string, message: string): Response =>
  new Response(
    JSON.stringify({ code, message, requestId: crypto.randomUUID() }),
    {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }
  );

const denyPage = (status: number, message: string): Response =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>拒绝访问</title><p style="font-family:system-ui;padding:2rem">${status} — ${message}</p>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );

const markAdmin = (response: Response): Response => {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
};

const PORTFOLIO_DYNAMIC_PREFIXES = [
  "/projects",
  "/api/projects",
  "/sitemap-projects.xml",
];

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url } = context;
  const path = url.pathname;
  const env = (context.locals.runtime?.env ?? {}) as RuntimeEnv;

  const isAdminPath =
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path === "/api/admin" ||
    path.startsWith("/api/admin/");

  if (isAdminPath) {
    const config: AccessConfig = {
      teamDomain: env.ACCESS_TEAM_DOMAIN ?? "",
      // 每个 Access 应用独立 aud;/admin 与 /api/admin 两个应用时为 CSV 多值
      aud: CSV(env.ACCESS_AUD),
      allowedEmails: CSV(env.ADMIN_EMAILS),
      allowedHosts: CSV(env.ADMIN_ALLOWED_HOSTS).map(h => h.toLowerCase()),
    };
    if (!isAccessConfigured(config)) {
      const response = path.startsWith("/api/admin/")
        ? json(503, "admin_unconfigured", "管理端未配置,失败关闭。")
        : denyPage(503, "管理端未配置,失败关闭。");
      return markAdmin(response);
    }

    const access = await verifyAccessRequest(request, config);
    if (!access.ok) {
      const status = access.reason === "email_not_allowed" ? 403 : 401;
      const response = path.startsWith("/api/admin/")
        ? json(status, access.reason, "身份验证失败。")
        : denyPage(status, "身份验证失败。");
      return markAdmin(response);
    }

    // 写请求:Origin / Sec-Fetch-Site / Content-Type / CSRF(§10.4)
    if (!SAFE_METHODS.has(request.method)) {
      const host = (hostOf(request) ?? "").toLowerCase();
      const siteOrigin = `https://${host}`;
      const origin = request.headers.get("Origin");
      if (!origin || origin !== siteOrigin || !siteOrigin) {
        return markAdmin(json(403, "origin_rejected", "Origin 校验失败。"));
      }
      const fetchSite = request.headers.get("Sec-Fetch-Site");
      if (fetchSite && fetchSite !== "same-origin") {
        return markAdmin(json(403, "cross_site_rejected", "跨站写入被拒绝。"));
      }
      const contentType = request.headers.get("Content-Type") ?? "";
      if (!contentType.startsWith("application/json")) {
        return markAdmin(
          json(415, "content_type_rejected", "仅接受 application/json。")
        );
      }
      const csrfSecret = env.CSRF_SECRET ?? "";
      if (!csrfSecret) {
        return markAdmin(
          json(503, "admin_unconfigured", "CSRF 未配置,失败关闭。")
        );
      }
      const token = request.headers.get("X-Portfolio-CSRF");
      const ok = await verifyCsrfToken(csrfSecret, token, {
        sub: access.identity.sub,
        origin: siteOrigin,
      });
      if (!ok) {
        return markAdmin(json(403, "csrf_rejected", "CSRF 校验失败。"));
      }
    }

    context.locals.adminIdentity = access.identity;
    const response = await next();
    return markAdmin(response);
  }

  // 动态作品路由:禁止整页缓存(计划 §12.3 初版策略)
  const isPortfolioDynamic =
    path === "/" ||
    PORTFOLIO_DYNAMIC_PREFIXES.some(
      p => path === p || path.startsWith(`${p}/`) || path.startsWith(p)
    );
  if (isPortfolioDynamic) {
    const response = await next();
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  return next();
});

function hostOf(request: Request): string | null {
  const host = request.headers.get("Host");
  if (host) return host;
  try {
    return new URL(request.url).host;
  } catch {
    return null;
  }
}
