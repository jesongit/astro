interface Window {
  theme?: {
    themeValue: string;
    setPreference: () => void;
    reflectPreference: () => void;
    getTheme: () => string;
    setTheme: (val: string) => void;
  };
}

/**
 * 一次构建注入的文章发布资格判断时点(见 astro.config.ts 的 vite.define)。
 * 生产环境由构建时值替换;postFilter 据此判断定时文章是否已到发布时间,
 * 保证静态页面与 SSR 首页使用同一时点(计划 §11.1)。
 */
declare const SITE_BUILD_TIME: number;

/**
 * Server-side Cloudflare bindings and GitHub integration variables.  These
 * values are read only from Astro.locals.runtime and are never public env
 * variables; in particular GITHUB_TOKEN must not use a PUBLIC_ prefix.
 */
interface AppRuntimeEnv {
  PORTFOLIO_CONTROL?: unknown;
  PORTFOLIO_CACHE?: unknown;
  PORTFOLIO_JOBS?: unknown;
  GITHUB_TOKEN?: string;
  GITHUB_PAT?: string;
  GITHUB_REPOSITORY?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_REPOSITORY_NAME?: string;
  GITHUB_BRANCH?: string;
  PORTFOLIO_BRANCH?: string;
  GITHUB_SETTINGS_PATH?: string;
  PORTFOLIO_SETTINGS_PATH?: string;
  GITHUB_WORKFLOW_ID?: string;
  GITHUB_WORKFLOW_FILE?: string;
  PORTFOLIO_WORKFLOW_ID?: string;
  PORTFOLIO_WORKFLOW?: string;
  GITHUB_API_VERSION?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  ADMIN_ALLOWED_HOSTS?: string;
  CSRF_SECRET?: string;
}

declare namespace App {
  interface Locals {
    /** @astrojs/cloudflare 12.x 注入的运行时;本地 dev 由 platformProxy 模拟 */
    runtime?: {
      env: Partial<AppRuntimeEnv>;
    };
    /** 管理路径鉴权通过后由 middleware 注入(计划 §10) */
    adminIdentity?: { email: string; sub: string };
  }
}
