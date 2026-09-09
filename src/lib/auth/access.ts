/**
 * Cloudflare Access JWT 验证(计划 §10.4):
 * - 从 Cf-Access-Jwt-Assertion 取 JWT,用固定 team domain 的 JWKS 验签;
 * - 校验 issuer、audience、exp/nbf 与允许的签名算法;
 * - JWKS 进程内缓存,处理 key rotation;
 * - 任何失败都拒绝(失败关闭),不信任邮箱 header/Cookie/CF-Connecting-IP。
 *
 * 测试注入:verifyAccessJwtWithKey 接受任意 KeyLike,
 * 自动化测试用本地生成的签名密钥替换远程 JWKS(§10.4)。
 */
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyOptions,
  type KeyLike,
} from "jose";

export interface AccessIdentity {
  email: string;
  sub: string;
}

export interface AccessConfig {
  /** 形如 <team>.cloudflareaccess.com */
  teamDomain: string;
  /** 允许的 application audience;每个 Access 应用独立 aud,管理页与 API 分属两个应用时为多值 */
  aud: string[];
  allowedEmails: string[];
  allowedHosts: string[];
}

export type AccessVerifyResult =
  | { ok: true; identity: AccessIdentity }
  | {
      ok: false;
      reason:
        | "unconfigured"
        | "host_not_allowed"
        | "missing_jwt"
        | "jwt_invalid"
        | "email_not_allowed";
    };

interface JwksEntry {
  url: string;
  jwks: ReturnType<typeof createRemoteJWKSet>;
}

let jwksCache: JwksEntry | null = null;

function getJwks(teamDomain: string): JwksEntry["jwks"] {
  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  if (!jwksCache || jwksCache.url !== url) {
    jwksCache = { url, jwks: createRemoteJWKSet(new URL(url)) };
  }
  return jwksCache.jwks;
}

export function isAccessConfigured(config: AccessConfig): boolean {
  return (
    config.teamDomain.length > 0 &&
    config.aud.length > 0 &&
    config.allowedEmails.length > 0 &&
    config.allowedHosts.length > 0
  );
}

/** 只接受明确白名单内的请求 Host,禁止别名域名绕过(§10.3) */
function hostAllowed(request: Request, config: AccessConfig): boolean {
  const hostHeader = request.headers.get("Host");
  let host = hostHeader;
  if (!host) {
    try {
      host = new URL(request.url).host;
    } catch {
      return false;
    }
  }
  return config.allowedHosts.includes(host.toLowerCase());
}

interface AccessClaims {
  email: string;
  sub: string;
}

function claimsOk(
  payload: Partial<AccessClaims>,
  config: AccessConfig
): AccessVerifyResult {
  const email = typeof payload.email === "string" ? payload.email : "";
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  if (!email || !config.allowedEmails.includes(email)) {
    return { ok: false, reason: "email_not_allowed" };
  }
  return { ok: true, identity: { email, sub } };
}

const verifyOptions = (config: AccessConfig): JWTVerifyOptions => ({
  issuer: `https://${config.teamDomain}/`,
  audience: config.aud,
  algorithms: ["RS256", "ES256"],
  clockTolerance: 5,
});

/** 生产路径:远程 JWKS */
export async function verifyAccessRequest(
  request: Request,
  config: AccessConfig
): Promise<AccessVerifyResult> {
  if (!isAccessConfigured(config)) {
    return { ok: false, reason: "unconfigured" };
  }
  if (!hostAllowed(request, config)) {
    return { ok: false, reason: "host_not_allowed" };
  }
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return { ok: false, reason: "missing_jwt" };

  try {
    const { payload } = await jwtVerify(
      token,
      getJwks(config.teamDomain),
      verifyOptions(config)
    );
    return claimsOk(payload as Partial<AccessClaims>, config);
  } catch {
    return { ok: false, reason: "jwt_invalid" };
  }
}

/** 测试路径:由调用方提供验证密钥(本地生成的签名密钥,§10.4) */
export async function verifyAccessJwtWithKey(
  token: string,
  key: KeyLike | Uint8Array,
  config: AccessConfig
): Promise<AccessVerifyResult> {
  if (!isAccessConfigured(config)) {
    return { ok: false, reason: "unconfigured" };
  }
  try {
    const { payload } = await jwtVerify(token, key, verifyOptions(config));
    return claimsOk(payload as Partial<AccessClaims>, config);
  } catch {
    return { ok: false, reason: "jwt_invalid" };
  }
}
