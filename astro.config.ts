import { defineConfig, envField } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import { SITE } from "./src/config";

/**
 * 文章发布资格的唯一判断时点(计划 §11.1):
 * 一次构建注入一个固定值,静态页面与 SSR 首页共用,
 * 防止 SSR 首页在运行时列出晚于本次构建的定时文章。
 */
const SITE_BUILD_TIME = Date.now();

// https://astro.build/config
export default defineConfig({
  site: SITE.website,
  // 保持静态默认:仅声明了 prerender = false 的路由走按需渲染(计划 §3.1)
  output: "static",
  adapter: cloudflare({
    // 图片在构建期用 sharp 处理预渲染页面,运行时请求链不引入 sharp(计划 §18.1)
    imageService: "compile",
    // 本地 dev 通过 platformProxy 模拟 KV bindings;生产 bindings 来自 wrangler.jsonc
    platformProxy: { enabled: true },
  }),
  integrations: [
    sitemap({
      filter: page => SITE.showArchives || !page.endsWith("/archives"),
    }),
  ],
  markdown: {
    remarkPlugins: [remarkToc, [remarkCollapse, { test: "Table of contents" }]],
    shikiConfig: {
      // For more themes, visit https://shiki.style/themes
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  vite: {
    define: {
      SITE_BUILD_TIME: JSON.stringify(SITE_BUILD_TIME),
    },
    // 原生/Node-only 模块仅在构建期预渲染(OG 图片)时可用,
    // 不得进入 workerd 运行时请求链(计划 §2.3/§18.1)
    ssr: {
      external: ["@resvg/resvg-js", "sharp"],
    },
    // eslint-disable-next-line
    // @ts-ignore
    // This will be fixed in Astro 6 with Vite 7 support
    // See: https://github.com/withastro/astro/issues/14030
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
  image: {
    responsiveStyles: true,
    layout: "constrained",
  },
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  experimental: {
    preserveScriptOrder: true,
  },
});
