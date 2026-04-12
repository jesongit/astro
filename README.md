# Posase 的个人博客

![AstroPaper](public/astropaper-og.jpg)

基于 [AstroPaper](https://github.com/satnaing/astro-paper) 主题构建的个人博客，使用 Astro + TailwindCSS。

- 站点：https://www.posase.im/
- 博客文章：`src/data/blog/*.md`

## 特性

- [x] 类型安全的 Markdown
- [x] 极致的性能表现
- [x] 无障碍访问（键盘/屏幕阅读器）
- [x] 响应式设计（移动端 ~ 桌面端）
- [x] SEO 友好
- [x] 亮色/暗色模式
- [x] 模糊搜索
- [x] 草稿文章与分页
- [x] Sitemap 与 RSS 订阅
- [x] 动态 OG 图片生成

## 项目结构

```bash
/
├── public/
│   ├── pagefind/               # 构建时自动生成
│   ├── favicon.svg
│   └── astropaper-og.jpg
├── src/
│   ├── assets/                 # 图标和图片资源
│   ├── components/             # 组件
│   ├── data/
│   │   └── blog/               # 博客文章（Markdown）
│   ├── layouts/                # 布局
│   ├── pages/                  # 页面路由
│   ├── styles/                 # 样式
│   ├── utils/                  # 工具函数
│   ├── config.ts               # 站点配置
│   ├── constants.ts            # 常量
│   └── content.config.ts       # 内容 Schema 定义
├── BLOG_STYLE_GUIDE.md         # 博客写作规范
├── CLAUDE.md                   # AI 辅助写作指引
└── astro.config.ts             # Astro 配置
```

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 框架 | [Astro](https://astro.build/) |
| 类型检查 | [TypeScript](https://www.typescriptlang.org/) |
| 样式 | [TailwindCSS](https://tailwindcss.com/) |
| 静态搜索 | [Pagefind](https://pagefind.app/) |
| 图标 | [Tabler Icons](https://tabler-icons.io/) |
| 代码格式化 | [Prettier](https://prettier.io/) |
| 代码检查 | [ESLint](https://eslint.org) |
| 部署 | [Cloudflare Pages](https://pages.cloudflare.com/) |

## 本地运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 常用命令

所有命令在项目根目录下执行：

| 命令 | 说明 |
| :--- | :--- |
| `npm install` | 安装依赖 |
| `npm run dev` | 启动本地开发服务器（`localhost:4321`） |
| `npm run build` | 构建生产环境站点到 `./dist/` |
| `npm run preview` | 本地预览构建产物 |
| `npm run format` | 使用 Prettier 格式化代码 |
| `npm run lint` | 使用 ESLint 检查代码 |

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
