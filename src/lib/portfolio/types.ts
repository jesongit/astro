/**
 * 作品公开投影的展示层类型。
 *
 * 字段边界遵循 docs/plans/portfolio_development_plan.md §4.1 / §5.3 / §11.2:
 * - 只携带允许公开展示的白名单数据,不含管理设置、原始配置、任务与错误详情;
 * - 版本与下载只来自 GitHub Releases,`release: null` 表示无正式 Release,
 *   展示层不得渲染版本号或下载按钮;
 * - slug 为系统推导的 `gh-<GitHub 数字 ID>`,不接受配置或页面自定义。
 */

/** Release 附件按规则识别的平台分组(§7.4);checksum 含校验和/签名/SBOM 等 */
export type ProjectPlatform =
  | "windows"
  | "macos"
  | "linux"
  | "other"
  | "checksum";

export interface ProjectCover {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface ProjectScreenshot {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface ProjectLinks {
  /** GitHub 仓库地址,始终来自 GitHub 事实 */
  github: string;
  /** 增强配置或经校验的 homepage;`null` 表示明确隐藏 */
  website?: string | null;
  demo?: string | null;
  docs?: string | null;
}

export interface GitHubFacts {
  /** owner/name,如 jesongit/aurora-theme */
  fullName: string;
  url: string;
  stars: number;
  license: string | null;
  language: string | null;
}

export interface ReleaseAsset {
  name: string;
  sizeBytes: number;
  url: string;
  platform: ProjectPlatform;
}

export interface ProjectRelease {
  /** 只来自 GitHub Releases 的 tag_name */
  tagName: string;
  /** published_at(ISO 8601) */
  publishedAt: string;
  /** 清洗后的 Release Notes(纯文本行) */
  notes: string[];
  assets: ReleaseAsset[];
  releaseUrl: string;
  /** GitHub 自动生成的 source zip/tar,可单列「源代码」,不算安装包 */
  sourceZipUrl?: string;
  sourceTarUrl?: string;
}

export interface PublicProject {
  slug: string;
  title: string;
  summary: string;
  topics: string[];
  techStack: string[];
  features: string[];
  /** 安全清洗后的介绍正文 HTML;缺失时详情页不渲染「介绍」模块 */
  bodyHtml?: string;
  /** 缺封面时卡片显示色块 + 首字母,不使用伪截图 */
  cover?: ProjectCover | null;
  screenshots: ProjectScreenshot[];
  links: ProjectLinks;
  github: GitHubFacts;
  release: ProjectRelease | null;
}

/** GitHub Actions build 生成的稳定公开快照;不含设置、观察或原始来源缓存。 */
export interface PortfolioSnapshot {
  schemaVersion: 1;
  generatedAt: string;
  owner: string;
  ownerType: string;
  inventoryRunId: string;
  projects: PublicProject[];
}

/* ───────────── 管理与来源状态(计划 §4.1 / §8) ───────────── */

/** 人工展示设置;只接受管理 API 写入,Sync Worker 无写路径 */
export interface DisplaySettings {
  schemaVersion: 1;
  repoId: string;
  /** 默认缺失即隐藏 */
  visible: boolean;
  /** visible=false 时公开层一律无效 */
  featured: boolean;
  /** 0..1_000_000 */
  order: number;
  /** 管理员已确认的撤下事件;未确认的新事件会阻止恢复展示 */
  acknowledgedIncidentId: string | null;
  /** 服务端生成的乐观并发标识,仅尽力冲突检测 */
  revision: string;
  updatedAt: string;
  updatedBy: string;
}

export type Eligibility = "public" | "unavailable" | "out_of_scope" | "unknown";

export type AttemptState = "success" | "partial" | "error";

export type ConfigState = "absent" | "valid" | "invalid" | "fetch_error";

export type PortfolioMode = "basic" | "enhanced";

export type ReleaseState = "present" | "none" | "stale" | "error";

/** 不可变的单仓库来源观察(计划 §8.1) */
export interface SourceObservation {
  schemaVersion: 1;
  repoId: string;
  nodeId: string;
  fullName: string;
  eligibility: Eligibility;
  attemptState: AttemptState;
  observedAt: string;
  lastPublicVerifiedAt: string | null;
  /** 本次内容 payload 的内容寻址引用;null 表示无可展示内容 */
  payloadHash: string | null;
  configState: ConfigState;
  mode: PortfolioMode;
  releaseState: ReleaseState;
  lastContentSuccessAt: string | null;
  /** 仅管理端可见的安全错误码 */
  warnings: string[];
}

/** 仓库失去公开资格的撤下事件(墓碑,长期保留) */
export interface Incident {
  incidentId: string;
  repoId: string;
  fullName: string;
  reason: "private" | "not_found" | "out_of_scope";
  observedAt: string;
}

/** 候选清单(完整枚举结果,不可变) */
export interface Inventory {
  schemaVersion: 1;
  runId: string;
  completed: boolean;
  observedAt: string;
  repos: { repoId: string; fullName: string; nodeId: string }[];
}

/** 内容寻址 payload(计划 §8.1 v1:payload:<sha256>) */
export interface PortfolioContent {
  schemaVersion: 1;
  title: string;
  summary: string;
  /** 已清洗正文 HTML */
  bodyHtml: string;
  /** 纯文本摘要(搜索与降级展示用) */
  bodyTextPlain: string;
  features: string[];
  techStack: string[];
  topics: string[];
  links: ProjectLinks;
  github: GitHubFacts;
  release: ProjectRelease | null;
  additionalDownloads: {
    label: string;
    url: string;
    kind: "store" | "package" | "external";
    description?: string;
  }[];
  cover?: ProjectCover | null;
  screenshots: ProjectScreenshot[];
  sanitizerVersion: string;
}

/** 审计记录(计划 §8.1 v1:audit) */
export interface AuditEntry {
  schemaVersion: 1;
  at: string;
  actor: string;
  repoId: string | null;
  action: string;
  before: unknown;
  after: unknown;
}

/** 手动同步任务(计划 §8.1 JOBS) */
export interface SyncJob {
  schemaVersion: 1;
  jobId: string;
  scope: { kind: "all" } | { kind: "repo"; repoId: string };
  requestedBy: string;
  createdAt: string;
  expiresAt: string;
}

export type SyncJobState =
  | "queued"
  | "running"
  | "succeeded"
  | "partial"
  | "failed"
  | "expired"
  | "interrupted";

export interface SyncJobResult {
  schemaVersion: 1;
  jobId: string;
  runId: string;
  state: SyncJobState;
  counts?: Record<string, number>;
  errorCodes?: string[];
  retryAt?: string;
  updatedAt: string;
}
