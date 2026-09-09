# Posase 的个人博客

![AstroPaper](public/astropaper-og.jpg)

基于 [AstroPaper](https://github.com/satnaing/astro-paper) 主题构建的个人博客，使用 Astro + TailwindCSS，部署在 Cloudflare Pages，并带有作品展示与 GitHub 自动同步能力。

- 站点：https://www.posase.im/
- 博客文章：`src/data/blog/*.md`
- 作品展示：`/projects/`（数据来自 GitHub 同步，经发布门禁过滤）
- 作品接入指南：`/portfolio-guide/`

## 特性

- [x] 类型安全的 Markdown
- [x] 极致的性能表现
- [x] 无障碍访问（键盘/屏幕阅读器）
- [x] 响应式设计（移动端 ~ 桌面端）
- [x] SEO 友好
- [x] 亮色/暗色模式
- [x] 模糊搜索（文章 Pagefind + 作品 API 双来源）
- [x] 草稿文章与分页
- [x] Sitemap 与 RSS 订阅
- [x] 动态 OG 图片生成
- [x] 作品展示 + GitHub Releases 多平台下载
- [x] Cloudflare Access 保护的独立管理页

## 项目结构

```bash
/
├── public/
│   ├── pagefind/               # 构建时自动生成
│   ├── favicon.svg
│   └── astropaper-og.jpg
├── src/
│   ├── assets/                 # 图标和图片资源
│   ├── components/             # 组件（含 portfolio/ 作品组件）
│   ├── data/
│   │   └── blog/               # 博客文章（Markdown）
│   ├── layouts/                # 布局（含 AdminLayout）
│   ├── lib/
│   │   ├── admin/              # 管理 API 共享工具
│   │   ├── auth/               # Access JWT / CSRF
│   │   └── portfolio/          # 作品协议、存储、门禁、搜索
│   ├── pages/                  # 页面路由（含 projects/、admin/、api/）
│   ├── scripts/                # 客户端脚本（含 admin.ts）
│   ├── styles/                 # 样式
│   ├── utils/                  # 工具函数
│   ├── middleware.ts           # 管理鉴权与缓存头
│   ├── config.ts               # 站点配置
│   ├── constants.ts            # 常量
│   └── content.config.ts       # 内容 Schema 定义
├── workers/
│   └── portfolio-sync/         # 独立定时同步 Worker（Cron → GitHub → KV）
├── scripts/                    # 构建与产物检查脚本
├── tests/                      # 纯逻辑 / Worker / e2e 测试
├── docs/
│   ├── plans/                  # 开发计划
│   └── portfolio/              # 协议 / 部署 / 运维文档
├── wrangler.jsonc              # Pages 配置（占位值需按 runbook 填写）
└── astro.config.ts             # Astro 配置
```

## 技术栈

| 类别       | 技术                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| 框架       | [Astro](https://astro.build/)（静态默认 + 少量按需渲染）                                                 |
| 运行时     | [Cloudflare Pages](https://pages.cloudflare.com/) + 独立 [Workers](https://workers.cloudflare.com/) Cron |
| 存储       | [Cloudflare Workers KV](https://developers.cloudflare.com/kv/)（CONTROL / CACHE / JOBS）                 |
| 鉴权       | [Cloudflare Access](https://www.cloudflare.com/zero-trust/) JWT + HMAC CSRF                              |
| 类型检查   | [TypeScript](https://www.typescriptlang.org/)                                                            |
| 样式       | [TailwindCSS](https://tailwindcss.com/)                                                                  |
| 静态搜索   | [Pagefind](https://pagefind.app/)                                                                        |
| 测试       | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/)                                    |
| 代码格式化 | [Prettier](https://prettier.io/)                                                                         |
| 代码检查   | [ESLint](https://eslint.org)                                                                             |

## 本地运行

统一使用 pnpm（10.11.1+，CI 与本地一致），不要使用 npm。

```bash
# 安装依赖
pnpm install --frozen-lockfile

# 启动开发服务器
pnpm run dev
```

## 常用命令

所有命令在项目根目录下执行：

| 命令                             | 说明                                           |
| :------------------------------- | :--------------------------------------------- |
| `pnpm install --frozen-lockfile` | 安装依赖（锁定版本）                           |
| `pnpm run dev`                   | 启动本地开发服务器（`localhost:4321`）         |
| `pnpm run build`                 | astro check → 构建 → Pagefind → 复制索引       |
| `pnpm run preview:cloudflare`    | 用 Wrangler 预览构建产物（含本地 KV）          |
| `pnpm run test`                  | 纯逻辑/协议/门禁/鉴权测试                      |
| `pnpm run test:worker`           | Worker 集成测试（workerd + 本地 KV）           |
| `pnpm run test:e2e`              | Playwright 烟囱验收（需先 build 并安装浏览器） |
| `pnpm run check:artifact`        | 产物检查（草稿/secret/管理页未静态化）         |
| `pnpm run check:routes`          | SSR 路由清单检查                               |
| `pnpm run format`                | 使用 Prettier 格式化代码                       |
| `pnpm run lint`                  | 使用 ESLint 检查代码                           |

## 部署与运维

部署配置（`wrangler.jsonc` 与 `workers/portfolio-sync/wrangler.jsonc`）中的项目名、KV namespace ID、Access 值为占位符，必须由拥有 Cloudflare 权限的操作者按以下文档填写与上线：

- [`docs/portfolio/deployment.md`](docs/portfolio/deployment.md) — 部署配置与上线顺序
- [`docs/portfolio/runbook.md`](docs/portfolio/runbook.md) — 日常运维、故障处理与回滚
- [`docs/portfolio/protocol-v1.md`](docs/portfolio/protocol-v1.md) — 作品增强配置协议 v1

## 写作规范

博客文章遵循 [`BLOG_STYLE_GUIDE.md`](BLOG_STYLE_GUIDE.md) 中定义的写作规范，包括：

- Frontmatter 字段规则
- 标签分类体系
- 中英文排版规范（中英文之间加空格）
- Markdown 格式约定
- SEO 检查清单

## 许可证

基于 MIT 许可证，Copyright © 2025

---

主题来自 [AstroPaper](https://github.com/satnaing/astro-paper)，由 [Sat Naing](https://satnaing.dev) 开发。
