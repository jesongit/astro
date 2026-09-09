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
    headers: { "Content-Type": "application/json; charset=utf-8" },
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
    { status, headers: { "Content-Type": "application/json; charset=utf-8" } }
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
  control: ControlStore;
  cache: PublicCacheStore;
  jobs: JobsStore;
}

/** 从 locals.runtime.env 构造只读/受限存储;缺失时返回 null(调用方 503) */
export function adminRuntime(locals: App.Locals): AdminRuntime | null {
  const env = locals.runtime?.env ?? {};
  const control = env.PORTFOLIO_CONTROL as PortfolioKV | undefined;
  const cache = env.PORTFOLIO_CACHE as PortfolioKV | undefined;
  const jobs = env.PORTFOLIO_JOBS as PortfolioKV | undefined;
  if (!control || !cache || !jobs) return null;
  if (typeof control.get !== "function") return null;
  return {
    control: new ControlStore(control),
    cache: new PublicCacheStore(cache),
    jobs: new JobsStore(jobs),
  };
}

export const notConfigured = (): Response =>
  jsonError(503, "bindings_missing", "KV 绑定不可用,暂不能管理作品。");
