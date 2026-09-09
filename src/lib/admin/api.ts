/**
 * 管理 API 共享工具(计划 §10.2):
 * 统一错误结构 / 请求体上限 / 未知字段拒绝 / KV 存储构造。
 */
import {
  ControlStore,
  JobsStore,
  PublicCacheStore,
  type PortfolioKV,
} from "@/lib/portfolio/store";
import { LIMITS } from "@/lib/portfolio/config";
import {
  GitHubAdminClient,
  GitHubAdminError,
  getGitHubAdminConfig,
  SettingsConflictError,
  SettingsFileError,
} from "./github";
import { createSettingsBackend, type AdminSettingsBackend } from "./settings";

export interface ApiErrorBody {
  code: string;
  message: string;
  requestId: string;
  fieldErrors?: { path: string; message: string }[];
  retryAt?: string;
}

export const jsonOk = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });

export const jsonError = (
  status: number,
  code: string,
  message: string,
  extra?: Partial<ApiErrorBody>
): Response =>
  new Response(
    JSON.stringify({
      code,
      message,
      requestId: crypto.randomUUID(),
      ...extra,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    }
  );

/** 读取并校验 JSON body:≤16KiB、对象、未知字段拒绝 */
export async function readJsonBody(
  request: Request,
  allowedKeys: readonly string[]
): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: Response }
> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > LIMITS.adminBodyMaxBytes) {
    return {
      ok: false,
      response: jsonError(413, "body_too_large", "请求体超过上限。"),
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      response: jsonError(400, "invalid_json", "JSON 解析失败。"),
    };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      response: jsonError(400, "invalid_body", "请求体必须是对象。"),
    };
  }
  const record = parsed as Record<string, unknown>;
  const unknownKeys = Object.keys(record).filter(k => !allowedKeys.includes(k));
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      response: jsonError(422, "unknown_fields", "存在不允许的字段。", {
        fieldErrors: unknownKeys.map(k => ({ path: k, message: "未知字段" })),
      }),
    };
  }
  return { ok: true, body: record };
}

export interface AdminRuntime {
  /** Optional legacy read/write adapters retained only for old deployments. */
  control: ControlStore | null;
  cache: PublicCacheStore | null;
  jobs: JobsStore | null;
  github: GitHubAdminClient | null;
}

/** 从 locals.runtime.env 构造 GitHub 优先的管理运行时。 */
export function adminRuntime(locals: App.Locals): AdminRuntime | null {
  const env = (locals.runtime?.env ?? {}) as Record<string, unknown>;
  const control = env.PORTFOLIO_CONTROL as PortfolioKV | undefined;
  const cache = env.PORTFOLIO_CACHE as PortfolioKV | undefined;
  const jobs = env.PORTFOLIO_JOBS as PortfolioKV | undefined;
  const validControl =
    control && typeof control.get === "function"
      ? new ControlStore(control)
      : null;
  const githubConfig = getGitHubAdminConfig(env);
  const github = githubConfig ? new GitHubAdminClient(githubConfig) : null;
  if (!github && (!cache || !jobs)) return null;
  return {
    control: validControl,
    cache: cache ? new PublicCacheStore(cache) : null,
    jobs: jobs ? new JobsStore(jobs) : null,
    github,
  };
}

export function adminSettings(
  runtime: AdminRuntime
): AdminSettingsBackend | null {
  return createSettingsBackend(runtime.github, runtime.control);
}

/** Convert safe, classified upstream/configuration failures to API errors. */
export function adminIntegrationError(error: unknown): Response {
  if (error instanceof SettingsConflictError) {
    return jsonError(409, "settings_conflict", error.message, {
      fieldErrors: [{ path: "revision", message: "设置文件版本已变化。" }],
    });
  }
  if (error instanceof SettingsFileError) {
    return jsonError(502, "settings_invalid", error.message);
  }
  if (error instanceof GitHubAdminError) {
    if (error.status === 409) {
      return jsonError(
        409,
        "settings_conflict",
        "设置文件版本已变化,请刷新后重试。"
      );
    }
    if (error.status === 401) {
      return jsonError(503, "github_unconfigured", "GitHub 服务端凭据不可用。");
    }
    if (error.status === 403 || error.status === 429) {
      return jsonError(
        503,
        "github_rate_limited",
        "GitHub 请求受限,请稍后重试。"
      );
    }
    if (error.status === 404) {
      return jsonError(502, "github_not_found", "GitHub 目标资源不存在。");
    }
    return jsonError(503, "github_unavailable", error.message);
  }
  return jsonError(503, "admin_upstream_error", "管理服务暂时不可用。");
}

export const notConfigured = (): Response =>
  jsonError(503, "admin_unconfigured", "GitHub 管理服务尚未配置。");
