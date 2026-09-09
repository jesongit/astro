/**
 * 管理 CSRF token(计划 §10.4):
 * HMAC(CSRF_SECRET) 签名,绑定 Access sub + 允许 origin + 随机 nonce,
 * 10 分钟到期;token 只驻留当前页面内存,不落 Cookie。
 */

const TOKEN_TTL_MS = 10 * 60_000;

const enc = new TextEncoder();

const b64url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const b64urlDecode = (text: string): Uint8Array => {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
};

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return b64url(new Uint8Array(sig));
}

export interface CsrfContext {
  sub: string;
  /** 允许的站点 origin,如 https://www.posase.im */
  origin: string;
}

/** 签发 CSRF token;secret 仅存在于服务端(计划 §13.1 CSRF_SECRET) */
export async function createCsrfToken(
  secret: string,
  ctx: CsrfContext,
  now = Date.now()
): Promise<{ token: string; expiresAt: string }> {
  const expires = now + TOKEN_TTL_MS;
  const nonce = crypto.randomUUID();
  const payload = [ctx.sub, ctx.origin, String(expires), nonce].join("|");
  const sig = await hmacSign(secret, payload);
  const body = BufferUnicodeSafe(payload);
  return {
    token: `${body}.${sig}`,
    expiresAt: new Date(expires).toISOString(),
  };
}

function BufferUnicodeSafe(payload: string): string {
  return b64url(enc.encode(payload));
}

/** 验证:签名、绑定身份与 origin、未过期;任何不满足即 false */
export async function verifyCsrfToken(
  secret: string,
  token: string | null,
  ctx: CsrfContext,
  now = Date.now()
): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  let payload: string;
  try {
    payload = new TextDecoder().decode(b64urlDecode(token.slice(0, dot)));
  } catch {
    return false;
  }
  const [tokenSub, tokenOrigin, expiresRaw] = payload.split("|");
  if (tokenSub !== ctx.sub || tokenOrigin !== ctx.origin) return false;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < now) return false;
  const expectedSig = await hmacSign(secret, payload);
  // 常数时间比较
  const a = enc.encode(token.slice(dot + 1));
  const b = enc.encode(expectedSig);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
