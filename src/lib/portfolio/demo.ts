import type { PublicProject } from "./types";

/**
 * ⚠️ UI 开发夹具 —— 仅用于作品页样式开发,不是真实数据。
 *
 * 正式数据必须来自 Sync Worker 写入 KV、经发布门禁过滤的公开投影
 * (开发计划 §4 / §8 / §9)。接入数据层后本文件将被
 * store 的 publicProjects() 读取路径替换,不得进入生产展示路径。
 *
 * 夹具刻意覆盖了计划中的关键展示分支:
 * - gh-1001:完整增强资料 + 多平台 Release 附件;
 * - gh-1012:基础资料 + Release(仅 GitHub 事实);
 * - gh-1020:无 README 正文、附件只有 zip(归「其他附件」);
 * - gh-1008 / gh-1027 / gh-1033:无正式 Release(不渲染版本与下载)。
 */

const AURORA_BODY = [
  '<h3 id="why">为什么写这个主题</h3>',
  "<p>市面上的博客主题大多功能繁杂、依赖沉重。Aurora 只保留写作真正需要的东西:清晰排版、快速检索与体面的分享卡片,其余一切都可以通过配置关闭。</p>",
  '<pre><code>// astro.config.ts\nimport aurora from "aurora-theme";\n\nexport default defineConfig({\n  integrates: [aurora({ search: "pagefind" })],\n});</code></pre>',
  "<blockquote>少即是多——每一行默认样式都要为自己的存在辩护。</blockquote>",
  '<h3 id="quickstart">快速开始</h3>',
  "<ul>\n<li>克隆模板仓库并安装依赖;</li>\n<li>修改 <code>src/config.ts</code> 中的站点信息;</li>\n<li>运行 <code>pnpm dev</code> 即可本地预览。</li>\n</ul>",
].join("\n");

const SHIGUANG_BODY = [
  "<p>拾光相册把家庭照片按时间线组织,支持按人物聚类浏览。全部数据保存在自己的服务器上,原图通过带签名的直链分享,不经过任何第三方云。</p>",
  "<p>单个二进制内置 SQLite,下载后一行命令即可启动,也提供 Docker Compose 配置。</p>",
].join("\n");

const MD2PDF_BODY = [
  "<p>md2pdf 读取一个 Markdown 目录,按文件名顺序批量排版为单个 PDF,标题层级、列表与代码块的高亮都会保留。</p>",
  "<pre><code>md2pdf ./docs -o handbook.pdf --toc</code></pre>",
].join("\n");

export const DEMO_PROJECTS: PublicProject[] = [
  {
    slug: "gh-1001",
    title: "Aurora 博客主题",
    summary:
      "为 Astro 打造的双栏博客主题,内置深浅色、阅读进度与全文搜索,一行配置即可接入 Pagefind。",
    topics: ["astro", "tailwind", "blog-theme"],
    techStack: ["TypeScript", "Astro", "Tailwind CSS"],
    features: [
      "深浅色主题一键切换,自动跟随系统",
      "内置 Pagefind 中文全文搜索",
      "文章阅读进度条与代码一键复制",
      "构建时自动生成 OG 分享图片",
      "响应式布局,移动端深度优化",
      "标签、归档与 RSS 全套支持",
    ],
    bodyHtml: AURORA_BODY,
    cover: null,
    screenshots: [],
    links: {
      github: "https://github.com/jesongit/aurora-theme",
      website: "https://aurora.posase.im/",
      demo: null,
      docs: null,
    },
    github: {
      fullName: "jesongit/aurora-theme",
      url: "https://github.com/jesongit/aurora-theme",
      stars: 128,
      license: "MIT",
      language: "TypeScript",
    },
    release: {
      tagName: "v2.4.0",
      publishedAt: "2026-08-12T04:00:00Z",
      notes: [
        "新增:归档页按年份折叠",
        "修复:暗色模式下代码块对比度不足",
        "升级:适配 Astro 5.16",
      ],
      assets: [
        {
          name: "Aurora.Setup.2.4.0.exe",
          sizeBytes: 25_808_486,
          url: "https://github.com/jesongit/aurora-theme/releases/download/v2.4.0/Aurora.Setup.2.4.0.exe",
          platform: "windows",
        },
        {
          name: "Aurora-2.4.0-win-x64.msi",
          sizeBytes: 27_368_611,
          url: "https://github.com/jesongit/aurora-theme/releases/download/v2.4.0/Aurora-2.4.0-win-x64.msi",
          platform: "windows",
        },
        {
          name: "Aurora-2.4.0-macos-universal.dmg",
          sizeBytes: 33_340_631,
          url: "https://github.com/jesongit/aurora-theme/releases/download/v2.4.0/Aurora-2.4.0-macos-universal.dmg",
          platform: "macos",
        },
        {
          name: "Aurora-2.4.0-linux-x86_64.AppImage",
          sizeBytes: 30_723_153,
          url: "https://github.com/jesongit/aurora-theme/releases/download/v2.4.0/Aurora-2.4.0-linux-x86_64.AppImage",
          platform: "linux",
        },
        {
          name: "aurora_2.4.0_amd64.deb",
          sizeBytes: 28_840_140,
          url: "https://github.com/jesongit/aurora-theme/releases/download/v2.4.0/aurora_2.4.0_amd64.deb",
          platform: "linux",
        },
        {
          name: "theme-gallery-pack.zip",
          sizeBytes: 4_404_224,
          url: "https://github.com/jesongit/aurora-theme/releases/download/v2.4.0/theme-gallery-pack.zip",
          platform: "other",
        },
        {
          name: "SHA256SUMS.txt",
          sizeBytes: 1_228,
          url: "https://github.com/jesongit/aurora-theme/releases/download/v2.4.0/SHA256SUMS.txt",
          platform: "checksum",
        },
        {
          name: "SHA256SUMS.sig",
          sizeBytes: 614,
          url: "https://github.com/jesongit/aurora-theme/releases/download/v2.4.0/SHA256SUMS.sig",
          platform: "checksum",
        },
      ],
      releaseUrl:
        "https://github.com/jesongit/aurora-theme/releases/tag/v2.4.0",
      sourceZipUrl:
        "https://github.com/jesongit/aurora-theme/archive/refs/tags/v2.4.0.zip",
      sourceTarUrl:
        "https://github.com/jesongit/aurora-theme/archive/refs/tags/v2.4.0.tar.gz",
    },
  },
  {
    slug: "gh-1012",
    title: "拾光相册",
    summary:
      "自托管家庭相册服务,支持时间线浏览、人脸聚类与原图直链,单个二进制即可部署。",
    topics: ["go", "self-hosted", "gallery"],
    techStack: ["Go", "SQLite"],
    features: [
      "时间线与日历两种浏览方式",
      "本地人脸聚类,按人物归档",
      "带签名的原图直链分享",
      "单个二进制 + SQLite,一行命令启动",
    ],
    bodyHtml: SHIGUANG_BODY,
    cover: null,
    screenshots: [],
    links: {
      github: "https://github.com/jesongit/shiguang-gallery",
      website: null,
      demo: null,
      docs: null,
    },
    github: {
      fullName: "jesongit/shiguang-gallery",
      url: "https://github.com/jesongit/shiguang-gallery",
      stars: 86,
      license: "GPL-3.0",
      language: "Go",
    },
    release: {
      tagName: "v1.3.1",
      publishedAt: "2026-07-30T10:30:00Z",
      notes: ["修复:EXIF 旋转方向解析错误", "性能:时间线首次加载提速约 40%"],
      assets: [
        {
          name: "Shiguang.Setup.1.3.1.exe",
          sizeBytes: 23_175_858,
          url: "https://github.com/jesongit/shiguang-gallery/releases/download/v1.3.1/Shiguang.Setup.1.3.1.exe",
          platform: "windows",
        },
        {
          name: "shiguang-1.3.1-darwin-arm64.tar.gz",
          sizeBytes: 21_288_742,
          url: "https://github.com/jesongit/shiguang-gallery/releases/download/v1.3.1/shiguang-1.3.1-darwin-arm64.tar.gz",
          platform: "macos",
        },
        {
          name: "shiguang-1.3.1-linux-amd64.tar.gz",
          sizeBytes: 19_816_521,
          url: "https://github.com/jesongit/shiguang-gallery/releases/download/v1.3.1/shiguang-1.3.1-linux-amd64.tar.gz",
          platform: "linux",
        },
        {
          name: "checksums-v1.3.1.txt",
          sizeBytes: 934,
          url: "https://github.com/jesongit/shiguang-gallery/releases/download/v1.3.1/checksums-v1.3.1.txt",
          platform: "checksum",
        },
      ],
      releaseUrl:
        "https://github.com/jesongit/shiguang-gallery/releases/tag/v1.3.1",
    },
  },
  {
    slug: "gh-1020",
    title: "梗图抽屉",
    summary: "一键收藏时间线梗图的浏览器扩展,支持标签整理与本地全文搜索。",
    topics: ["chrome-extension", "meme"],
    techStack: ["JavaScript", "Plasmo"],
    features: ["右键一键收藏图片", "本地标签整理", "梗图文字全文搜索"],
    // 无 bodyHtml:演示「README 缺失时详情不渲染介绍正文」的降级形态
    cover: null,
    screenshots: [],
    links: {
      github: "https://github.com/jesongit/meme-drawer",
      website: null,
      demo: null,
      docs: null,
    },
    github: {
      fullName: "jesongit/meme-drawer",
      url: "https://github.com/jesongit/meme-drawer",
      stars: 42,
      license: "MIT",
      language: "JavaScript",
    },
    release: {
      tagName: "v0.9.0",
      publishedAt: "2026-06-18T13:20:00Z",
      notes: ["首个公开预览版"],
      assets: [
        {
          name: "meme-drawer-0.9.0.zip",
          sizeBytes: 1_887_437,
          url: "https://github.com/jesongit/meme-drawer/releases/download/v0.9.0/meme-drawer-0.9.0.zip",
          platform: "other",
        },
      ],
      releaseUrl: "https://github.com/jesongit/meme-drawer/releases/tag/v0.9.0",
    },
  },
  {
    slug: "gh-1008",
    title: "md2pdf",
    summary: "把 Markdown 目录批量排版为 PDF 的小工具,保留标题层级与代码高亮。",
    topics: ["cli", "pdf"],
    techStack: ["Rust"],
    features: ["按目录批量转换", "保留标题层级与代码高亮", "支持生成目录页"],
    bodyHtml: MD2PDF_BODY,
    cover: null,
    screenshots: [],
    links: {
      github: "https://github.com/jesongit/md2pdf",
      website: null,
      demo: null,
      docs: null,
    },
    github: {
      fullName: "jesongit/md2pdf",
      url: "https://github.com/jesongit/md2pdf",
      stars: 56,
      license: "Apache-2.0",
      language: "Rust",
    },
    // 无正式 Release:详情页不渲染版本与下载模块
    release: null,
  },
  {
    slug: "gh-1027",
    title: "问答卡片生成器",
    summary: "输入一段笔记,自动排版成适合分享的问答卡片,可导出 PNG 与 SVG。",
    topics: ["canvas", "note-card"],
    techStack: ["TypeScript", "Canvas API"],
    features: ["Markdown 问答排版", "多套配色模板", "导出 PNG 与 SVG"],
    cover: null,
    screenshots: [],
    links: {
      github: "https://github.com/jesongit/quiz-card",
      website: null,
      demo: "https://quizcard.posase.im/",
      docs: null,
    },
    github: {
      fullName: "jesongit/quiz-card",
      url: "https://github.com/jesongit/quiz-card",
      stars: 31,
      license: "MIT",
      language: "TypeScript",
    },
    release: null,
  },
  {
    slug: "gh-1033",
    title: "Loopdo 循环待办",
    summary: "把待办按「今天 / 本周 / 以后」三栏循环安排的极简任务板。",
    topics: ["vue", "todo"],
    techStack: ["Vue 3", "Vite"],
    features: ["三栏循环安排", "本地优先,无账号", "键盘快捷操作"],
    cover: null,
    screenshots: [],
    links: {
      github: "https://github.com/jesongit/loopdo",
      website: null,
      demo: null,
      docs: null,
    },
    github: {
      fullName: "jesongit/loopdo",
      url: "https://github.com/jesongit/loopdo",
      stars: 18,
      license: "MIT",
      language: "Vue",
    },
    release: null,
  },
];
