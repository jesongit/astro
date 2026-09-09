/**
 * Small, Actions-friendly GitHub REST client.
 *
 * Invariants:
 * - URL construction is limited to api.github.com;
 * - cache keys contain API version/Accept/path, never the token;
 * - 304 is only accepted when the matching cached body exists;
 * - 401/429/low quota stop the run instead of retrying blindly;
 * - errors exposed to callers are stable codes, never upstream bodies/URLs.
 */
import { GITHUB_DEFAULTS } from "./constants.mjs";
import { sha256Hex, stableStringify } from "./state.mjs";

const API_ORIGIN = "https://api.github.com";

export class GitHubCredentialError extends Error {
  constructor() {
    super("github_credential_error");
    this.code = "github_credential_error";
  }
}

export class GitHubRateLimitError extends Error {
  constructor(retryAt) {
    super("github_rate_limited");
    this.code = "github_rate_limited";
    this.retryAt = retryAt;
  }
}

export class GitHubUpstreamError extends Error {
  constructor(status = 0, code = "github_upstream_error") {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export class GitHubBudgetError extends Error {
  constructor() {
    super("github_request_budget_exceeded");
    this.code = "github_request_budget_exceeded";
  }
}

const getHeader = (headers, name) => headers?.get?.(name) ?? null;

const parseRetryAt = (headers, now = Date.now()) => {
  const retryAfter = getHeader(headers, "Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return now + Math.max(0, seconds) * 1000;
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return date;
  }
  const reset = Number(getHeader(headers, "X-RateLimit-Reset"));
  return Number.isFinite(reset) && reset > 0 ? reset * 1000 : now + 60_000;
};

export function parseLinkHeader(value) {
  const links = {};
  if (!value) return links;
  for (const part of value.split(",")) {
    const match = /<([^>]+)>\s*;\s*rel="?([^";]+)"?/i.exec(part.trim());
    if (match) links[match[2]] = match[1];
  }
  return links;
}

const toApiUrl = value => {
  const url = new URL(value, API_ORIGIN);
  if (url.origin !== API_ORIGIN || url.protocol !== "https:") {
    throw new GitHubUpstreamError(400, "github_invalid_url");
  }
  return url;
};

const toApiPath = value => {
  const url = toApiUrl(value);
  return `${url.pathname}${url.search}`;
};

const jsonObject = value =>
  value && typeof value === "object" && !Array.isArray(value) ? value : null;

export class GitHubClient {
  constructor({
    token = "",
    owner = GITHUB_DEFAULTS.owner,
    ownerType = GITHUB_DEFAULTS.ownerType,
    apiVersion = GITHUB_DEFAULTS.apiVersion,
    cache = {},
    fetchImpl = globalThis.fetch,
    timeoutMs = GITHUB_DEFAULTS.timeoutMs,
    maxRequests = Number.POSITIVE_INFINITY,
    rateLimitPauseThreshold = GITHUB_DEFAULTS.rateLimitPauseThreshold,
    authScope = "public-read",
    now = () => Date.now(),
  } = {}) {
    if (typeof fetchImpl !== "function") throw new Error("fetch_unavailable");
    this.token = typeof token === "string" ? token : "";
    this.owner = owner;
    this.ownerType = ownerType;
    this.apiVersion = apiVersion;
    this.cache = cache;
    this.fetchImpl = fetchImpl.bind(globalThis);
    this.timeoutMs = timeoutMs;
    this.maxRequests = maxRequests;
    this.rateLimitPauseThreshold = rateLimitPauseThreshold;
    this.authScope = authScope;
    this.now = now;
    this.requestCount = 0;
  }

  get requestsUsed() {
    return this.requestCount;
  }

  async request(
    pathOrUrl,
    {
      accept = "application/vnd.github+json",
      maxResponseBytes = 2 * 1024 * 1024,
    } = {}
  ) {
    const path = toApiPath(pathOrUrl);
    const url = toApiUrl(path);
    const cacheKey = sha256Hex(
      `${this.apiVersion}|${this.authScope}|${accept}|${path}`
    );
    const cached = this.cache[cacheKey];
    const headers = {
      Accept: accept,
      "User-Agent": "posase-portfolio-actions-sync",
      "X-GitHub-Api-Version": this.apiVersion,
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (cached?.etag) headers["If-None-Match"] = cached.etag;

    let currentUrl = url;
    let redirected = 0;
    let unconditional = false;
    for (;;) {
      this.requestCount += 1;
      if (this.requestCount > this.maxRequests) throw new GitHubBudgetError();
      const response = await this.fetchImpl(currentUrl.toString(), {
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (response.status === 401) throw new GitHubCredentialError();
      const remainingHeader = getHeader(
        response.headers,
        "X-RateLimit-Remaining"
      );
      const remaining =
        remainingHeader === null ? Number.NaN : Number(remainingHeader);
      if (
        Number.isFinite(remaining) &&
        remaining < this.rateLimitPauseThreshold
      ) {
        throw new GitHubRateLimitError(
          parseRetryAt(response.headers, this.now())
        );
      }
      if (response.status === 304) {
        if (cached && !cached.notFound && cached.body !== undefined) {
          cached.lastValidatedAt = new Date(this.now()).toISOString();
          return {
            status: 200,
            body: cached.body,
            headers: new Headers(
              cached.headers ??
                (cached.link ? { Link: cached.link } : undefined)
            ),
            fromCache: true,
            notModified: true,
          };
        }
        if (unconditional) {
          throw new GitHubUpstreamError(304, "github_cache_body_missing");
        }
        delete headers["If-None-Match"];
        unconditional = true;
        currentUrl = url;
        continue;
      }
      if (response.status >= 300 && response.status < 400) {
        const location = getHeader(response.headers, "Location");
        if (!location || redirected >= 3) {
          throw new GitHubUpstreamError(
            response.status,
            "github_redirect_error"
          );
        }
        const next = toApiUrl(location);
        currentUrl = next;
        redirected += 1;
        continue;
      }
      if (response.status === 403 || response.status === 429) {
        throw new GitHubRateLimitError(
          parseRetryAt(response.headers, this.now())
        );
      }
      if (response.status === 404) {
        this.cache[cacheKey] = {
          etag: getHeader(response.headers, "ETag"),
          body: null,
          bodyHash: null,
          headers: { link: getHeader(response.headers, "Link") },
          fetchedAt: new Date(this.now()).toISOString(),
          lastValidatedAt: new Date(this.now()).toISOString(),
          status: 404,
          notFound: true,
        };
        return { status: 404, body: null, headers: response.headers };
      }
      if (!response.ok) {
        throw new GitHubUpstreamError(response.status);
      }

      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > maxResponseBytes) {
        throw new GitHubUpstreamError(413, "github_response_too_large");
      }
      let body = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          throw new GitHubUpstreamError(502, "github_invalid_json");
        }
      }
      const fetchedAt = new Date(this.now()).toISOString();
      this.cache[cacheKey] = {
        etag: getHeader(response.headers, "ETag"),
        body,
        bodyHash: sha256Hex(stableStringify(body)),
        headers: { link: getHeader(response.headers, "Link") },
        fetchedAt,
        lastValidatedAt: fetchedAt,
        status: response.status,
        notFound: false,
      };
      // bodyHash is informational; avoid leaking a Promise into persisted state.
      this.cache[cacheKey].bodyHash = await this.cache[cacheKey].bodyHash;
      return { status: response.status, body, headers: response.headers };
    }
  }

  async getRepository(fullName) {
    const result = await this.request(`/repos/${encodeRepoName(fullName)}`);
    return {
      ...result,
      repository: result.status === 200 ? jsonObject(result.body) : null,
    };
  }

  async listRepositoriesPage(page = 1) {
    const endpoint =
      this.ownerType === "organization"
        ? `/orgs/${encodeURIComponent(this.owner)}/repos`
        : `/users/${encodeURIComponent(this.owner)}/repos`;
    const query = new URLSearchParams(
      this.ownerType === "organization"
        ? {
            type: "public",
            per_page: "100",
            sort: "full_name",
            page: String(page),
          }
        : {
            type: "owner",
            per_page: "100",
            sort: "full_name",
            page: String(page),
          }
    );
    const result = await this.request(`${endpoint}?${query}`);
    if (result.status === 404)
      return { repos: [], hasMore: false, next: null, headers: result.headers };
    if (!Array.isArray(result.body))
      throw new GitHubUpstreamError(502, "github_invalid_repo_list");
    const repos = result.body.flatMap(item => {
      if (!jsonObject(item)) return [];
      if (
        typeof item.id !== "number" ||
        typeof item.node_id !== "string" ||
        typeof item.full_name !== "string"
      ) {
        return [];
      }
      return [
        {
          id: item.id,
          node_id: item.node_id,
          full_name: item.full_name,
          private: item.private === true,
        },
      ];
    });
    const links = parseLinkHeader(getHeader(result.headers, "Link"));
    return {
      repos,
      hasMore:
        Boolean(links.next) ||
        (!getHeader(result.headers, "Link") && result.body.length === 100),
      next: links.next ? toApiPath(links.next) : null,
      headers: result.headers,
    };
  }

  async listRepositories() {
    const result = [];
    const seen = new Set();
    let page = 1;
    let next = null;
    for (;;) {
      const current = next
        ? await this.request(next)
        : await this.listRepositoriesPage(page);
      if (next && !Array.isArray(current.body)) {
        throw new GitHubUpstreamError(502, "github_invalid_repo_list");
      }
      const repos = next
        ? current.body.flatMap(item =>
            jsonObject(item) &&
            typeof item.id === "number" &&
            typeof item.node_id === "string" &&
            typeof item.full_name === "string"
              ? [
                  {
                    id: item.id,
                    node_id: item.node_id,
                    full_name: item.full_name,
                    private: item.private === true,
                  },
                ]
              : []
          )
        : current.repos;
      for (const repo of repos) {
        if (repo.private || seen.has(String(repo.id))) continue;
        seen.add(String(repo.id));
        result.push(repo);
      }
      const linkHeader = getHeader(current.headers, "Link");
      const links = parseLinkHeader(linkHeader);
      if (!next && current.next) {
        next = current.next;
        continue;
      }
      if (links.next) {
        next = toApiPath(links.next);
        continue;
      }
      if (!linkHeader && repos.length === 100) {
        page += 1;
        next = null;
        continue;
      }
      break;
    }
    return result.sort(
      (a, b) => a.id - b.id || a.full_name.localeCompare(b.full_name)
    );
  }

  async getCommitSha(fullName, branch) {
    const result = await this.request(
      `/repos/${encodeRepoName(fullName)}/commits/${encodeURIComponent(branch)}`
    );
    return result.status === 200 &&
      jsonObject(result.body) &&
      typeof result.body.sha === "string"
      ? result.body.sha
      : null;
  }

  async getTopics(fullName) {
    const result = await this.request(
      `/repos/${encodeRepoName(fullName)}/topics`
    );
    return result.status === 200 &&
      jsonObject(result.body) &&
      Array.isArray(result.body.names)
      ? result.body.names.filter(item => typeof item === "string")
      : [];
  }

  async getContentsDetailed(fullName, path, ref) {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const result = await this.request(
      `/repos/${encodeRepoName(fullName)}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
      { maxResponseBytes: 768 * 1024 }
    );
    if (result.status !== 200 || !jsonObject(result.body)) {
      return { ...result, content: null };
    }
    const body = result.body;
    if (typeof body.content !== "string" || body.encoding !== "base64") {
      throw new GitHubUpstreamError(502, "github_invalid_content");
    }
    return {
      ...result,
      content: {
        contentBase64: body.content.replace(/\s/g, ""),
        size: typeof body.size === "number" ? body.size : 0,
        path: typeof body.path === "string" ? body.path : path,
        sha: typeof body.sha === "string" ? body.sha : null,
      },
    };
  }

  async getReadme(fullName, ref) {
    const result = await this.request(
      `/repos/${encodeRepoName(fullName)}/readme?ref=${encodeURIComponent(ref)}`,
      { maxResponseBytes: 768 * 1024 }
    );
    if (result.status !== 200 || !jsonObject(result.body))
      return { ...result, content: null };
    const body = result.body;
    if (typeof body.content !== "string" || body.encoding !== "base64") {
      throw new GitHubUpstreamError(502, "github_invalid_readme");
    }
    return {
      ...result,
      content: {
        contentBase64: body.content.replace(/\s/g, ""),
        size: typeof body.size === "number" ? body.size : 0,
        path: typeof body.path === "string" ? body.path : "README.md",
        sha: typeof body.sha === "string" ? body.sha : null,
      },
    };
  }

  async getLatestRelease(fullName) {
    return this.request(`/repos/${encodeRepoName(fullName)}/releases/latest`, {
      maxResponseBytes: 2 * 1024 * 1024,
    });
  }

  async getReleaseAssets(release) {
    if (!jsonObject(release) || !release.assets_url) {
      return Array.isArray(release?.assets) ? release.assets : [];
    }
    const path = toApiPath(release.assets_url);
    const all = [];
    let current = path;
    for (;;) {
      const result = await this.request(current, {
        maxResponseBytes: 2 * 1024 * 1024,
      });
      if (result.status !== 200 || !Array.isArray(result.body)) {
        throw new GitHubUpstreamError(
          result.status,
          "github_invalid_release_assets"
        );
      }
      all.push(...result.body);
      const next = parseLinkHeader(getHeader(result.headers, "Link")).next;
      if (next) {
        current = toApiPath(next);
        continue;
      }
      if (!getHeader(result.headers, "Link") && result.body.length === 100) {
        const nextUrl = new URL(current, API_ORIGIN);
        nextUrl.searchParams.set(
          "page",
          String(Number(nextUrl.searchParams.get("page") ?? "1") + 1)
        );
        current = toApiPath(nextUrl);
        continue;
      }
      return all;
    }
  }
}

const encodeRepoName = fullName =>
  String(fullName).split("/").map(encodeURIComponent).join("/");
