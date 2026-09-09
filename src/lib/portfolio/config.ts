/**
 * 两部署共享的作品容量、公开资格与节奏参数(计划 §5 / §7 / §8 / §10)。
 * 纯常量模块:不得依赖 Astro 运行时、DOM 或 Node 原生模块,
 * Pages SSR 与 Sync Worker 共用同一来源,防止语义漂移。
 */

export const PROTOCOL = {
  currentVersion: 1,
  entryFile: ".portfolio/portfolio.json",
  schemaPath: "/api/portfolio/schema/v1.json",
  specPath: "/api/portfolio/spec.json",
  promptPath: "/api/portfolio/prompt.txt",
  guidePath: "/portfolio-guide/",
} as const;

/** 内容与素材容量上限(§5.2 / §7.3 / §8.1) */
export const LIMITS = {
  configMaxBytes: 32 * 1024,
  bodyMaxBytes: 128 * 1024,
  imageMaxBytes: 2 * 1024 * 1024,
  imagesTotalMaxBytes: 8 * 1024 * 1024,
  readmeMaxBytes: 256 * 1024,
  payloadMaxBytes: 512 * 1024,
  titleMaxLength: 80,
  summaryMaxLength: 240,
  summaryFallback: "项目资料见 GitHub 仓库。",
  /** 基础模式从 README 抽取的摘要长度(Unicode 字符) */
  readmeSummaryChars: 180,
  /** 管理请求 JSON body 上限(§10.2) */
  adminBodyMaxBytes: 16 * 1024,
  /** 搜索查询长度与上限(§12.2) */
  searchQueryMin: 2,
  searchQueryMax: 80,
  searchMaxResults: 20,
} as const;

/** 公开资格与缓存节奏(§7.2 / §9.2) */
export const PUBLICATION = {
  /** 公开资格有效期:30 分钟保守上限 */
  publicValidityMinutes: 30,
  /** 公开状态检查周期:10 分钟 */
  publicCheckMinutes: 10,
  /** Release 缓存最大复用时间 */
  releaseStaleMaxHours: 24,
} as const;

/** 同步节奏与预算(§8.2) */
export const SYNC = {
  contentSyncMinutes: 60,
  discoverySyncMinutes: 360,
  /** 单 tick 工作预算 */
  tickBudgetMs: 40_000,
  /** 每 tick 最多上游请求次数 */
  maxUpstreamRequestsPerTick: 30,
  /** 单个 GitHub 请求超时 */
  singleRequestTimeoutMs: 8_000,
  /** 手动全量同步冷却 */
  fullSyncCooldownMs: 10 * 60_000,
  /** 单仓库同步冷却 */
  repoSyncCooldownMs: 60_000,
  /** running 状态超过该时间标记 interrupted */
  stuckRunningMs: 5 * 60_000,
  /** 手动任务有效期 */
  jobExpiresMs: 24 * 60 * 60_000,
  /** 运行日志保留 */
  runRetentionDays: 30,
  /** 任务结果保留 */
  resultRetentionDays: 30,
  /** 审计保留 */
  auditRetentionDays: 90,
  /** 无引用 payload 回收前的宽限 */
  payloadGcGraceMs: 48 * 60 * 60_000,
  /** rate limit 剩余阈值,低于则暂停本轮 */
  rateLimitPauseThreshold: 10,
} as const;

/** 管理端限制(§8.1 / §10.1) */
export const ADMIN = {
  /** 首页精选数量上限 */
  featuredHomeLimit: 6,
  /** order 允许范围 */
  orderMin: 0,
  orderMax: 1_000_000,
  defaultOrder: 1000,
  /** 公开列表每页数量 */
  projectsPerPage: 12,
  /** 候选列表分页上限 */
  adminPageSize: 100,
} as const;

/** KV key 前缀(§8.1);reverseTime 为固定宽度反向毫秒编码,新记录字典序在前 */
export const KEYS = {
  settings: (repoId: string) => `v1:settings:${repoId}`,
  auditPrefix: "v1:audit:",
  audit: (reverseTime: string, uuid: string) =>
    `v1:audit:${reverseTime}:${uuid}`,
  inventoryPrefix: "v1:inventory:",
  inventory: (reverseTime: string, runId: string) =>
    `v1:inventory:${reverseTime}:${runId}`,
  obsPrefix: (repoId: string) => `v1:obs:${repoId}:`,
  obs: (repoId: string, reverseTime: string, runId: string) =>
    `v1:obs:${repoId}:${reverseTime}:${runId}`,
  payload: (sha256: string) => `v1:payload:${sha256}`,
  incidentPrefix: (repoId: string) => `v1:incident:${repoId}:`,
  incident: (repoId: string, reverseTime: string, uuid: string) =>
    `v1:incident:${repoId}:${reverseTime}:${uuid}`,
  httpCache: (hash: string) => `v1:http:${hash}`,
  run: (runId: string) => `v1:run:${runId}`,
  jobRequest: (uuid: string) => `v1:request:${uuid}`,
  jobRequestPrefix: "v1:request:",
  jobResult: (uuid: string, runId: string) => `v1:result:${uuid}:${runId}`,
  jobResultPrefix: (uuid: string) => `v1:result:${uuid}:`,
} as const;

export const reverseTime = (now: number): string =>
  String(Number.MAX_SAFE_INTEGER - now).padStart(15, "0");

/** SHA-256 hex;Workers 与 Node 的 WebCrypto 均可用 */
export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const data =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    data as unknown as BufferSource
  );
  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 生成设置 revision(非 KV CAS,仅尽力冲突检测用,§8.4) */
export const newRevision = (): string =>
  `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
