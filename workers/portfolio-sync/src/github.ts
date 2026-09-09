/**
 * GitHub REST 客户端(计划 §7.1 / §7.2):
 * - 固定 API host、User-Agent、Accept、X-GitHub-Api-Version;
 * - 条件请求:ETag 缓存在 v1:http:<hash>,304 必须对应同一资源的已有 body;
 * - 遵守 Retry-After / X-RateLimit-Remaining,低于阈值抛 RateLimited;
 * - 单请求 8 秒超时;401 视为凭据错误,禁止盲重试。
 */
import { SYNC, sha256Hex } from "../../../src/lib/portfolio/config";
import type { SyncWriteStore } from "../../../src/lib/portfolio/store";

export interface GitHubClientOptions {
  token: string;
  owner: string;
  ownerType: string;
  apiVersion: string;
  httpCache: SyncWriteStore;
  timeoutMs?: number;
  /** 测试注入;生产默认全局 fetch */
  fetchImpl?: typeof fetch;
  /** 计数器:每 tick 最多 30 次上游请求(§8.2) */
  onRequest?: () => void;
}

export class RateLimitedError extends Error {
  constructor(
    public readonly retryAt: number,
    message = "GitHub rate limited"
  ) {
    super(message);
  }
}

export class CredentialError extends Error {
  constructor(message = "GitHub token 失效(401)") {
    super(message);
  }
}

export class UpstreamError extends Error {
  constructor(
    public readonly status: number,
    message = "GitHub upstream error"
  ) {
    super(message);
  }
}

interface CacheEntry {
  etag: string | null;
  body: unknown;
  fetchedAt: string;
  notFound?: boolean;
}

export class GitHubClient {
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: GitHubClientOptions) {
    this.timeoutMs = opts.timeoutMs ?? SYNC.singleRequestTimeoutMs;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /** fullName 形如 owner/name;仓库级端点统一用它拼路径(§7.2 /repos/{owner}/{repo}) */
  private repoPath(fullName: string): string {
    return `/repos/${fullName}`;
  }

  private async request(
    path: string,
    accept = "application/vnd.github+json"
  ): Promise<{
    status: number;
    json: unknown | null;
  }> {
    this.opts.onRequest?.();
    const url = `https://api.github.com${path}`;
    const keyHash = await sha256Hex(
      `${this.opts.apiVersion}|${accept}|${path}`
    );
    const cached =
      await this.opts.httpCache.getHttpCacheEntry<CacheEntry>(keyHash);

    const headers: Record<string, string> = {
      "User-Agent": "posase-portfolio-sync",
      Accept: accept,
      "X-GitHub-Api-Version": this.opts.apiVersion,
      Authorization: `Bearer ${this.opts.token}`,
    };
    if (cached?.etag) headers["If-None-Match"] = cached.etag;

    const response = await this.fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const rateRemaining = response.headers.get("X-RateLimit-Remaining");
    if (rateRemaining !== null && Number(rateRemaining) < 10) {
      const resetHeader = response.headers.get("X-RateLimit-Reset");
      const retryAt = response.headers.get("Retry-After")
        ? Date.now() + Number(response.headers.get("Retry-After")) * 1000
        : resetHeader
          ? Number(resetHeader) * 1000
          : Date.now() + 60_000;
      throw new RateLimitedError(retryAt);
    }

    if (response.status === 304) {
      // 304 必须对应同一资源的已有 body;丢失则无条件重取一次
      if (cached && !cached.notFound) {
        return { status: 200, json: cached.body };
      }
      return this.requestUncached(url, headers, keyHash, accept);
    }

    if (response.status === 401) throw new CredentialError();
    if (response.status === 403 || response.status === 429) {
      const retryAt = response.headers.get("Retry-After")
        ? Date.now() + Number(response.headers.get("Retry-After")) * 1000
        : Date.now() + 60_000;
      throw new RateLimitedError(retryAt);
    }

    const etag = response.headers.get("ETag");
    if (response.status === 404) {
      await this.opts.httpCache.putHttpCacheEntry(keyHash, {
        etag,
        body: null,
        fetchedAt: new Date().toISOString(),
        notFound: true,
      } satisfies CacheEntry);
      return { status: 404, json: null };
    }
    if (response.status >= 500) {
      throw new UpstreamError(response.status);
    }
    if (!response.ok) {
      throw new UpstreamError(response.status);
    }

    const json: unknown = await response.json();
    await this.opts.httpCache.putHttpCacheEntry(keyHash, {
      etag,
      body: json,
      fetchedAt: new Date().toISOString(),
    } satisfies CacheEntry);
    return { status: response.status, json };
  }

  private async requestUncached(
    url: string,
    headers: Record<string, string>,
    keyHash: string,
    _accept: string
  ): Promise<{ status: number; json: unknown | null }> {
    delete headers["If-None-Match"];
    this.opts.onRequest?.();
    const response = await this.fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (response.status === 404) {
      await this.opts.httpCache.putHttpCacheEntry(keyHash, {
        etag: null,
        body: null,
        fetchedAt: new Date().toISOString(),
        notFound: true,
      } satisfies CacheEntry);
      return { status: 404, json: null };
    }
    if (!response.ok) throw new UpstreamError(response.status);
    const json: unknown = await response.json();
    await this.opts.httpCache.putHttpCacheEntry(keyHash, {
      etag: response.headers.get("ETag"),
      body: json,
      fetchedAt: new Date().toISOString(),
    } satisfies CacheEntry);
    return { status: response.status, json };
  }

  /** 公开仓库枚举:owner 类型决定端点;返回单页结果与 Link 是否还有下一页 */
  async listRepositoriesPage(page: number): Promise<{
    repos: {
      id: number;
      node_id: string;
      full_name: string;
      private: boolean;
    }[];
    hasMore: boolean;
  }> {
    const suffix =
      this.opts.ownerType === "organization"
        ? `/orgs/${this.opts.owner}/repos?type=public`
        : `/users/${this.opts.owner}/repos?type=owner`;
    const { status, json } = await this.request(
      `${suffix}&per_page=100&sort=full_name&page=${page}`
    );
    if (status === 404 || json === null) return { repos: [], hasMore: false };
    if (!Array.isArray(json)) throw new UpstreamError(500);
    const repos = json.flatMap(item => {
      if (typeof item !== "object" || item === null) return [];
      const r = item as Record<string, unknown>;
      if (
        typeof r.id !== "number" ||
        typeof r.full_name !== "string" ||
        typeof r.node_id !== "string"
      ) {
        return [];
      }
      return [
        {
          id: r.id,
          node_id: r.node_id,
          full_name: r.full_name,
          private: r.private === true,
        },
      ];
    });
    return { repos, hasMore: json.length === 100 };
  }

  /** 仓库事实:校验 ID/owner/private(§8.3.2) */
  async getRepo(fullName: string): Promise<{
    status: number;
    repo: (Record<string, unknown> & { id: number }) | null;
  }> {
    const { status, json } = await this.request(this.repoPath(fullName));
    if (status !== 200 || typeof json !== "object" || json === null) {
      return { status, repo: null };
    }
    return { status, repo: json as Record<string, unknown> & { id: number } };
  }

  async getTopics(fullName: string): Promise<string[]> {
    const { json } = await this.request(`${this.repoPath(fullName)}/topics`);
    if (
      typeof json === "object" &&
      json !== null &&
      Array.isArray((json as Record<string, unknown>).names)
    ) {
      return (json as { names: unknown[] }).names.filter(
        (n): n is string => typeof n === "string"
      );
    }
    return [];
  }

  /** 默认分支当前 commit SHA */
  async getCommitSha(fullName: string, branch: string): Promise<string | null> {
    const { status, json } = await this.request(
      `${this.repoPath(fullName)}/commits/${encodeURIComponent(branch)}`
    );
    if (status !== 200 || typeof json !== "object" || json === null)
      return null;
    const sha = (json as Record<string, unknown>).sha;
    return typeof sha === "string" ? sha : null;
  }

  async getReadme(
    fullName: string,
    ref: string
  ): Promise<{ contentBase64: string; size: number } | null> {
    const { status, json } = await this.request(
      `${this.repoPath(fullName)}/readme?ref=${encodeURIComponent(ref)}`
    );
    return this.contentsFromJson(status, json);
  }

  async getContents(
    fullName: string,
    path: string,
    ref: string
  ): Promise<{ contentBase64: string; size: number } | null> {
    const { status, json } = await this.request(
      `${this.repoPath(fullName)}/contents/${path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}?ref=${encodeURIComponent(ref)}`
    );
    return this.contentsFromJson(status, json);
  }

  private contentsFromJson(
    status: number,
    json: unknown
  ): { contentBase64: string; size: number } | null {
    if (status !== 200 || typeof json !== "object" || json === null)
      return null;
    const record = json as Record<string, unknown>;
    if (typeof record.content !== "string" || record.encoding !== "base64") {
      return null;
    }
    return {
      contentBase64: record.content.replace(/\n/g, ""),
      size: typeof record.size === "number" ? record.size : 0,
    };
  }

  async getLatestRelease(fullName: string): Promise<{
    status: number;
    json: unknown | null;
  }> {
    return this.request(`${this.repoPath(fullName)}/releases/latest`);
  }

  get owner(): string {
    return this.opts.owner;
  }
}
