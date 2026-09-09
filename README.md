# Posase 的个人博客

![AstroPaper](public/astropaper-og.jpg)

基于 [AstroPaper](https://github.com/satnaing/astro-paper) 主题构建的个人博客，使用 Astro + TailwindCSS，部署在 Cloudflare Pages，并带有作品展示与 GitHub 自动同步能力。

- 站点：https://www.posase.im/
- 博客文章：`src/data/blog/*.md`
- 作品展示：`/projects/`（构建时读取 GitHub Actions 生成的 `data/portfolio/projects.json`）
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
- [x] GitHub Actions 定时同步、生成快照并负责构建

## 项目结构

```bash
/
├── public/
│   ├── pagefind/               # 构建时自动生成
│   ├── favicon.svg
│   └── astropaper-og.jpg
├── data/
│   └── portfolio/             # settings / sources / projects（GitHub 事实文件）
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
│   └── portfolio-sync/         # 旧 KV Worker，待账号侧切换后按审计清单退役
├── scripts/                    # 构建、产物检查与 portfolio 同步脚本
├── tests/                      # 纯逻辑 / Worker / e2e 测试
├── docs/
│   ├── plans/                  # 开发计划
│   └── portfolio/              # 协议 / 部署 / 运维文档
├── wrangler.jsonc              # Pages 配置（占位值需按 runbook 填写）
└── astro.config.ts             # Astro 配置
```

## 技术栈

| 类别       | 技术                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------- |
| 框架       | [Astro](https://astro.build/)（静态默认 + 少量按需渲染）                                  |
| 运行时     | [Cloudflare Pages](https://pages.cloudflare.com/) + GitHub Actions 定时同步/构建/可选部署 |
| 数据事实源 | GitHub 仓库中的 `data/portfolio/settings.json`、`sources.json`、`projects.json`           |
| 旧资源     | Cloudflare KV / 独立 Worker 仅作为待退役兼容边界，账号侧不在本次代码提交中删除            |
| 鉴权       | [Cloudflare Access](https://www.cloudflare.com/zero-trust/) JWT + HMAC CSRF               |
| 类型检查   | [TypeScript](https://www.typescriptlang.org/)                                             |
| 样式       | [TailwindCSS](https://tailwindcss.com/)                                                   |
| 静态搜索   | [Pagefind](https://pagefind.app/)                                                         |
| 测试       | [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/)                     |
| 代码格式化 | [Prettier](https://prettier.io/)                                                          |
| 代码检查   | [ESLint](https://eslint.org)                                                              |

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

| 命令                               | 说明                                                            |
| :--------------------------------- | :-------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`   | 安装依赖（锁定版本）                                            |
| `pnpm run dev`                     | 启动本地开发服务器（`localhost:4321`）                          |
| `pnpm run build`                   | astro check → 构建 → Pagefind → 复制索引                        |
| `pnpm run preview:cloudflare`      | 用 Wrangler 预览构建产物                                        |
| `pnpm run test`                    | 纯逻辑/协议/门禁/鉴权测试                                       |
| `pnpm run test:worker`             | 旧 Worker 兼容边界集成测试（workerd + 本地 KV）                 |
| `pnpm run test:e2e`                | Playwright 烟囱验收（需先 build 并安装浏览器）                  |
| `pnpm run typecheck`               | Astro + Sync Worker TypeScript 类型检查                         |
| `pnpm run check:artifact`          | 产物检查（草稿/secret/管理页未静态化）                          |
| `pnpm run check:routes`            | SSR 路由清单检查                                                |
| `pnpm run portfolio:sync -- full`  | Actions 同步全部公开仓库并生成三个 GitHub 数据文件              |
| `pnpm run portfolio:sync -- build` | 仅由 settings + sources 重建 `projects.json`                    |
| `pnpm run verify:all`              | 按 CI 顺序运行 lint、类型、单测、Worker、构建、产物、路由和 e2e |
| `pnpm run format`                  | 使用 Prettier 格式化代码                                        |
| `pnpm run lint`                    | 使用 ESLint 检查代码                                            |

## 部署与运维

作品数据的事实源是 GitHub JSON；Admin 通过服务端 GitHub Contents API 保存 settings，再触发 `portfolio.yml` 的 `build` 模式。Actions 的 `full` / `repo` 模式同步 GitHub 并提交变化，公开页只读取 `projects.json`。Cloudflare Pages 的生产 Git 集成或 Actions 部署只能保留一个所有者。

旧 `wrangler` 绑定、Worker、KV 和 Cron 资源本次只记录，不执行删除；详见清理审计。任何 token、CSRF secret、验证码或其他凭据都不得提交：

- [`docs/portfolio/deployment.md`](docs/portfolio/deployment.md) — 部署配置与上线顺序
- [`docs/portfolio/runbook.md`](docs/portfolio/runbook.md) — 日常运维、故障处理与回滚
- [`docs/portfolio/protocol-v1.md`](docs/portfolio/protocol-v1.md) — 作品增强配置协议 v1
- [`docs/portfolio/acceptance-matrix.md`](docs/portfolio/acceptance-matrix.md) — 可重复验收矩阵与已知缺口

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
