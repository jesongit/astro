/// <reference types="@cloudflare/workers-types" />

/**
 * Sync Worker 环境绑定(计划 §13.3)。
 * 关键约束:本 Worker 对 PORTFOLIO_CONTROL 只有读路径——
 * 类型上不暴露任何 CONTROL 写方法,测试断言同步链路无法覆盖人工设置。
 */
export interface SyncEnv {
  PORTFOLIO_CONTROL: KVNamespace;
  PORTFOLIO_CACHE: KVNamespace;
  PORTFOLIO_JOBS: KVNamespace;
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_OWNER_TYPE: string;
  GITHUB_API_VERSION: string;
  SYNC_ENABLED: string;
}

export interface ScheduledControllerLike {
  scheduledTime: number;
  cron: string;
}
