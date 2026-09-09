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

declare namespace App {
  interface Locals {
    /** @astrojs/cloudflare 12.x 注入的运行时;本地 dev 由 platformProxy 模拟 */
    runtime?: {
      env: Partial<Record<string, unknown>>;
    };
    /** 管理路径鉴权通过后由 middleware 注入(计划 §10) */
    adminIdentity?: { email: string; sub: string };
  }
}
