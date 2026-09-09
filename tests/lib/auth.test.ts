/**
 * 鉴权与 CSRF 测试(计划 §10.4 / §17):
 * 使用本地生成的签名测试 JWT 与假域名配置,不访问真实 Cloudflare。
 * 远程 JWKS 路径由 verifyAccessJwtWithKey 的密钥注入替代(§10.4 测试注入层)。
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, type CryptoKeyPair } from "jose";
import {
  verifyAccessJwtWithKey,
  verifyAccessRequest,
  isAccessConfigured,
  type AccessConfig,
} from "@/lib/auth/access";
import { createCsrfToken, verifyCsrfToken } from "@/lib/auth/csrf";

const TEAM = "test-team.cloudflareaccess.com";
const AUD = "test-aud";

const config: AccessConfig = {
  teamDomain: TEAM,
  aud: [AUD],
  allowedEmails: ["admin@example.com"],
  allowedHosts: ["www.posase.im"],
};

let keys: CryptoKeyPair;
let publicKey: CryptoKey;

const signTestJwt = async (
  overrides: Record<string, unknown> = {}
): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    email: "admin@example.com",
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer((overrides.iss as string) ?? `https://${TEAM}`)
    .setAudience((overrides.aud as string) ?? AUD)
    .setSubject((overrides.sub as string) ?? "user-sub-1")
    .setIssuedAt((overrides.iat as number) ?? now)
    .setNotBefore((overrides.nbf as number) ?? now)
    .setExpirationTime((overrides.exp as number) ?? now + 300)
    .sign(keys.privateKey);
};

beforeAll(async () => {
  keys = (await generateKeyPair("RS256", {
    extractable: true,
  })) as CryptoKeyPair;
  publicKey = keys.publicKey;
  // 断言 JWK 形状对 kid/alg/use 的约定(与生产 JWKS 行为一致)
  const jwk = await exportJWK(keys.publicKey);
  jwk.kid = "test-key";
  jwk.alg = "RS256";
  expect(jwk.kty).toBe("RSA");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const makeRequest = (host = "www.posase.im", jwt?: string): Request =>
  new Request(`https://${host}/api/admin/session`, {
    method: "GET",
    headers: {
      ...(jwt ? { "Cf-Access-Jwt-Assertion": jwt } : {}),
    },
  });

describe("verifyAccessJwtWithKey(§10.4,失败关闭)", () => {
  it("有效 JWT + 允许邮箱 → 通过并回传身份", async () => {
    const jwt = await signTestJwt();
    const result = await verifyAccessJwtWithKey(jwt, publicKey, config);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.identity.email).toBe("admin@example.com");
  });

  it("aud/issuer 错误、过期、未生效 → jwt_invalid(失败关闭)", async () => {
    const cases = [
      await signTestJwt({ aud: "other-aud" }),
      await signTestJwt({ iss: "https://evil.example.com/" }),
      await signTestJwt({ exp: Math.floor(Date.now() / 1000) - 10 }),
      await signTestJwt({ nbf: Math.floor(Date.now() / 1000) + 120 }),
    ];
    for (const jwt of cases) {
      const result = await verifyAccessJwtWithKey(jwt, publicKey, config);
      expect(result.ok).toBe(false);
    }
  });

  it("多应用 audience:任一配置内的 aud 均可接受(管理页/API 分属两个应用)", async () => {
    const secondAppJwt = await signTestJwt({ aud: "second-app-aud" });
    expect(
      (
        await verifyAccessJwtWithKey(secondAppJwt, publicKey, {
          ...config,
          aud: [AUD, "second-app-aud"],
        })
      ).ok
    ).toBe(true);
    expect(
      (
        await verifyAccessJwtWithKey(secondAppJwt, publicKey, {
          ...config,
          aud: ["unrelated-aud"],
        })
      ).ok
    ).toBe(false);
  });

  it("越权邮箱 → email_not_allowed", async () => {
    const jwt = await signTestJwt({ email: "stranger@example.com" });
    const result = await verifyAccessJwtWithKey(jwt, publicKey, config);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("email_not_allowed");
  });

  it("未配置的 Access → unconfigured(不因缺配置放行)", async () => {
    const jwt = await signTestJwt();
    expect(
      (
        await verifyAccessJwtWithKey(jwt, publicKey, {
          ...config,
          teamDomain: "",
        })
      ).reason
    ).toBe("unconfigured");
    expect(isAccessConfigured({ ...config, allowedEmails: [] })).toBe(false);
  });

  it("verifyAccessRequest:缺 JWT / Host 不在白名单 → 拒绝", async () => {
    const missing = await verifyAccessRequest(
      makeRequest("www.posase.im"),
      config
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toBe("missing_jwt");

    const jwt = await signTestJwt();
    const badHost = await verifyAccessRequest(
      makeRequest("evil.example.com", jwt),
      config
    );
    expect(badHost.ok).toBe(false);
    if (!badHost.ok) expect(badHost.reason).toBe("host_not_allowed");
  });
});

describe("CSRF token(§10.4)", () => {
  const ctx = { sub: "user-sub-1", origin: "https://www.posase.im" };

  it("签发并验证通过;过期/绑定错/篡改拒绝", async () => {
    const { token, expiresAt } = await createCsrfToken(
      "secret-1",
      ctx,
      Date.now()
    );
    expect(expiresAt).toBeTruthy();
    expect(await verifyCsrfToken("secret-1", token, ctx)).toBe(true);

    const expired = await createCsrfToken(
      "secret-1",
      ctx,
      Date.now() - 11 * 60_000
    );
    expect(await verifyCsrfToken("secret-1", expired.token, ctx)).toBe(false);

    expect(
      await verifyCsrfToken("secret-1", token, {
        sub: "other",
        origin: ctx.origin,
      })
    ).toBe(false);
    expect(
      await verifyCsrfToken("secret-1", token, {
        sub: ctx.sub,
        origin: "https://evil.com",
      })
    ).toBe(false);
    expect(await verifyCsrfToken("secret-2", token, ctx)).toBe(false);
    expect(await verifyCsrfToken("secret-1", `${token}x`, ctx)).toBe(false);
    expect(await verifyCsrfToken("secret-1", null, ctx)).toBe(false);
  });
});
