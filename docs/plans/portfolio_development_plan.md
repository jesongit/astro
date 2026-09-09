# 作品展示与 GitHub 自动同步分阶段开发计划

> 编写日期：2026-09-08。本文件保留为历史设计与验收依据；代码状态以当前 HEAD、
> [作品验收矩阵](../portfolio/acceptance-matrix.md)和部署/运行手册为准。
> 下文“未实施/没有”只描述计划编写时的仓库快照，不得当作当前实现状态或生产上线证明。

## 1. 已确认的范围与架构结论

推荐保留 Astro 5 和现有博客的静态构建，在现有站点增加少量按需渲染路由；按仓库现有 Pages 线索，采用 **Cloudflare Pages 承载静态博客和 Astro 按需渲染页面，独立 Cloudflare Worker 承载 Cron 同步，共用分离的 KV 命名空间**。首页、作品列表、作品详情、管理页和动态 API 按需渲染；文章、标签、归档、RSS、博客 OG 图片和 Pagefind 继续在构建时生成。

网站只管理展示选择、精选、排序、稳定地址所需的身份信息及同步缓存。项目介绍和素材的内容源是 GitHub；正式版本、发布时间、Release Notes 和发布附件的唯一数据源是 GitHub Releases。

以下决策已经确定，开发时不再作为产品选择题：

1. 所有 `jesongit` 名下公开仓库都可进入候选池，包括 fork、归档仓库；默认不展示，不要求指定 Topic。
2. 基础模式不修改项目仓库；增强模式只对主动采用它的项目读取可选的 `.portfolio/portfolio.json`。
3. `visible`、`featured`、`order` 只接受管理 API 写入；增强配置出现这些字段必须校验失败。
4. 采用通用作品模板，无每项目独立页面开发，无 GitHub App、D1、Durable Objects、消息队列产品或复杂后台。
5. 手动同步按钮创建任务，由每分钟 Cron 消费；定期内容同步默认每小时一次，公开状态检查默认每 10 分钟一次。
6. 地址使用 `/projects/gh-<GitHub数字ID>/`，名称只影响页面标题；接受 URL 可读性略低的取舍，换取无需可变 slug 映射及重命名迁移。
7. 不调用线上 LLM 自动编造文案；AI 在用户自己的项目环境中按公开协议生成可选增强内容。
8. 作品数据更新和管理设置变更不触发 Astro 全站重建；站点代码或博客文章变更仍走部署构建。
9. KV 是最终一致存储，不承诺全球立即下架或强事务。通过独立发布门禁、无额外页面缓存、不可变来源记录和保守故障处理控制旧数据暴露，具体边界见第 8、9 节。
10. 本项目尚在开发期，允许统一锁文件和调整组件接口；不为未实施的旧方案增加兼容层。

## 2. 仓库真实现状与复用清单

### 2.1 检查依据及边界

本节记录计划编写时的审阅结果。当前实现、测试命令和部署边界以验收矩阵及
`docs/portfolio/` 下的文档为准；不要用本节的历史快照判断功能是否已经合并。

计划编写时尚未存在的 Pages 配置、Cloudflare adapter、KV binding、Worker 入口和
SSR 路由现在已由代码提供；这些文件不应再被描述为“缺失”。CI 仍是代码质量流水线，
生产 Cloudflare 资源的变更仍不由本地验收自动执行。

本次对正式域名进行了只读访问，浏览工具未取得页面，命令行 TLS 握手失败，无法验证线上响应、Pages 项目名或控制台设置。没有访问 Cloudflare 账号，因此**不能声称已核实生产运行于 Pages 或已核实其绑定**。阶段 1 必须导出现有部署配置；推荐方案以当前代码和 Pages 线索为依据，部署核验是发布前置工作，不阻塞本计划定稿。

计划编写时未安装依赖或运行构建；后续执行结果见验收矩阵，不与本历史段落混用。

### 2.2 已实现能力：明确复用

| 能力 | 实际文件与行为 | 本计划处理 |
| --- | --- | --- |
| Astro 静态站点 | `astro.config.ts` 明确使用 `output: "static"` 与 Cloudflare adapter；按需路由声明 `prerender = false` | **已实现**静态默认与少量 SSR |
| 依赖与检查 | `package.json` 的 Astro 范围 `^5.16.6`；`astro check`、ESLint、Prettier 已存在 | **复用**检查链；增加 Worker/协议/联调检查 |
| 内容集合 | `src/content.config.ts` 使用 `glob` 和 Zod 定义 `blog`；必填标题、日期、描述，支持标签、草稿、精选和 canonical | **复用**；作品不混入 `blog` 集合 |
| 文章库 | `src/data/blog/` 下共 48 个 Markdown 文件，15 个显式 `draft: true`；含 tutorials、notes、leetcode、_drafts | **复用**全部原稿及目录；实际发布数量以构建为准 |
| 文章分页与详情 | `src/pages/posts/[...page].astro`、`posts/[...slug]/index.astro` 使用静态路径；`getPath.ts` 保留分类子目录 | **复用**原 URL 和分页规则 |
| 排序、标签与草稿过滤 | `postFilter.ts`、`getSortedPosts.ts`、`getUniqueTags.ts`、`getPostsByTag.ts` | **复用**；统一少量不一致的发布时间过滤入口 |
| 首页文章展示 | `src/pages/index.astro` 已有介绍、社交链接、置顶文章、最新文章和全部文章链接 | **修改布局**，作品移至首要位置；保留文章入口与精选能力 |
| 标签与归档 | `src/pages/tags/**`、`src/pages/archives/index.astro` | **复用**，保持静态 |
| 文章交互 | `PostDetails.astro` 已含 Markdown 正文、代码复制、阅读进度、标签、分享、上下篇、返回顶部 | **复用**博客实现；新作品页只复用必要组件，不复制整套文章逻辑 |
| 搜索 | `search.astro` 使用 `@pagefind/default-ui`，支持 `?q=`、懒加载和页面切换恢复；文章正文有 `data-pagefind-body` | **复用**博客全文搜索；增加独立作品搜索来源 |
| SEO 基础 | `Layout.astro` 已输出标题、描述、canonical、OG、Twitter、Google 验证及 JSON-LD | **复用并修正** JSON-LD 类型与可选值，不重写 SEO 系统 |
| RSS、robots、sitemap | `rss.xml.ts`、`robots.txt.ts`、`@astrojs/sitemap` | **复用**博客输出；追加动态作品 sitemap |
| OG 图片 | `og.png.ts`、`posts/[...slug]/index.png.ts`，Satori + Resvg 生成 PNG | **复用**构建时生成；当前所谓动态 OG 并非运行时 SSR |
| 主题与无障碍基础 | `Header.astro`、`Footer.astro`、`Main.astro`、`src/scripts/theme.ts`、全局样式 | **复用**深浅色、跳转正文、移动菜单、焦点样式与排版 |
| 页面切换 | `Layout.astro` 使用 `ClientRouter`；搜索、菜单等订阅 Astro 页面事件 | **复用并回归测试**，管理写入状态不跨页错误复用 |

### 2.3 已发现、需要纳入计划的问题

- **工具链/部署状态**：当前仓库以 `pnpm-lock.yaml`、`typecheck`、CI 和两个 Wrangler 配置为准；生产 namespace、Access 和 secret 仍由目标环境管理，不能写入验收输出。
- **Pagefind 构建**：已使用跨平台复制脚本，并由 `build`、`check:artifact` 和博客 e2e 回归共同验证。
- **结构化数据类型不正确**：`Layout.astro` 对所有页面输出 `BlogPosting`，无日期时可能生成字符串 `"undefined"`。应由页面传入结构化数据，非文章页使用正确类型。
- **发布时间过滤不一致**：列表、RSS 使用 `postFilter`，文章详情静态路径、文章 OG、归档主要只检查 `draft`。修复入口一致性，避免未来文章通过直接 URL 或 sitemap 提前暴露。
- **草稿目录不能仅凭注释判断**：glob 的 `[^_]*.md` 限制文件名，不足以把 `_drafts/` 的所有后代自动视为未发布。现有文件有显式草稿字段；增加目录排除规则及构建验证，不依赖 `CLAUDE.md` 中对该 glob 的说明。
- **运行时依赖隔离**：`@resvg/resvg-js`、`sharp` 和构建时 Google 字体下载不能被误带入作品 SSR 请求链。现有 OG 模板继续留在构建环境。
- **版心较窄**：`app-layout` 是 `max-w-3xl`；作品列表可增加专用宽版容器，不能全局拉宽文章阅读区域。

## 3. 推荐目标架构及渲染职责

```text
访客 ── www.posase.im
          ├─ Pages 静态文件：文章 / 标签 / 归档 / RSS / 博客 OG / Pagefind
          ├─ Astro 按需渲染：首页 / projects / 动态 sitemap / 公开作品 API
          │                      └─ 读取 CONTROL + CACHE，通过统一发布门禁
管理员 ── Cloudflare Access ── /admin 与 /api/admin
                                 ├─ CONTROL：展示、精选、排序
                                 └─ JOBS：手动同步请求、审计
Cloudflare Cron ── 独立 Sync Worker
                    ├─ 读取 JOBS 与 CONTROL
                    ├─ GitHub：公开仓库、Description、Topics、README、可选配置、Releases
                    └─ 写 CACHE 与 JOBS 状态；绝不写 CONTROL
任何 AI/用户 ── 公开规范 API ── 在目标仓库生成可选增强文件 ── GitHub 默认分支
```

### 3.1 选择依据与取舍

| 方式 | 结论 | 原因 |
| --- | --- | --- |
| 全静态 + 同步后触发重建 | 不采用 | 下架受构建与部署排队影响；每次排序也需发布；同步失败与旧构建容易让旧项目复活 |
| 静态空壳 + 浏览器抓取所有作品 | 不采用 | 详情初始 HTML 缺正文、canonical/OG 内容不足，SEO 与无 JS 访问较弱 |
| 整站 SSR | 不采用 | 会扩大原文章、RSS、OG、Pagefind 适配范围，没有必要 |
| Astro 静态默认 + 少量 SSR + 独立 Cron Worker | **推荐** | 复用 Astro 模板与 Pages 静态能力，作品更新无需构建；Cron 与页面职责清楚 |
| Worker 用字符串模板或 HTMLRewriter 自建作品页面 | 不采用 | 增加第二套模板和 SEO 实现，维护成本高于引入兼容 adapter |

Astro 支持保留默认静态输出并在个别路由声明 `export const prerender = false`。[Astro 按需渲染文档](https://docs.astro.build/en/guides/on-demand-rendering/)

**版本决策**：保持 Astro 5 主版本，采用并精确锁定 `@astrojs/cloudflare@12.6.13` 作为本计划的适配起点。本次只读查询 npm 元数据确认该版本 peer dependency 为 `astro: ^5.7.0`，与现有两个锁文件中的版本兼容。不能直接安装 `latest`：新版适配器已移除 Pages 支持。后续 Astro 6/Workers 迁移独立安排，不混入本次功能交付。[适配器升级说明](https://docs.astro.build/en/guides/integrations-guide/cloudflare/#upgrading-to-v13-and-astro-6)

阶段 1 的适配验证必须包含安全更新检查和实际 `workerd` 预览。依赖范围兼容不等于构建或运行已验证。

### 3.2 路由与职责

| 路由 | 渲染/执行 | 数据及缓存 |
| --- | --- | --- |
| `/` | SSR | KV 作品精选 + 现有 Content Layer 构建快照中的文章摘要；初版 `no-store` |
| `/projects/` | SSR | 已发布作品，按管理顺序；支持 GET 查询筛选 |
| `/projects/[slug]/` | SSR | KV 通用详情，先判断发布门禁再读内容 |
| 原 `/posts/**`、`/tags/**`、`/archives/`、`/about/` | 静态，**复用** | 原内容集合 |
| `/search/` | 静态壳，**复用并扩展** | 原 Pagefind + 动态作品查询 |
| `/rss.xml`、博客 OG、`/robots.txt` | 静态，**复用并局部修改** | 博客 RSS 不混入作品发布事件 |
| `/sitemap-index.xml`、`/sitemap-0.xml` 等 | 静态，**复用** | 仅静态站点 URL；不宣称自动收录动态作品 |
| `/sitemap-projects.xml` | 动态 | 同一个发布门禁下的作品；`robots.txt` 额外声明 |
| `/api/projects`、`/api/projects/search` | 动态只读 | 仅公开投影，无 KV 原始对象、管理状态或内部错误 |
| `/api/portfolio/spec.json`、`/api/portfolio/schema/v1.json`、`/api/portfolio/prompt.txt` | 构建生成的公开静态 API | 协议与提示词，不访问 KV、无需 Access |
| `/portfolio-guide/` | 静态 | 基础/增强说明、示例、复制提示词 |
| `/admin/`、`/api/admin/**` | SSR/API | Access + 服务端 JWT；`private, no-store`、`noindex` |
| Sync Worker | 仅 `scheduled` 消费任务 | 无公开 HTTP 同步接口；`fetch` 固定 404，关闭 workers.dev/预览 URL |

静态优先不意味着管理页能预渲染后只靠前端隐藏。管理页面本身和所有管理 API 都必须在响应之前完成鉴权。

## 4. 数据所有权与两种模式的数据流

### 4.1 三类对象必须分开

```ts
type DisplaySettings = {
  schemaVersion: 1;
  repoId: string;                 // GitHub ID，服务端校验，不接受任意 URL
  visible: boolean;               // 默认 false
  featured: boolean;              // 默认 false；visible=false 时公开层一律无效
  order: number;                  // 默认 1000；范围 0..1_000_000
  acknowledgedIncidentId: string | null;
  revision: string;               // 服务端生成，冲突提示用，不冒充 KV CAS
  updatedAt: string;
  updatedBy: string;              // 经验证的 Access sub
};

type SourceObservation = {
  schemaVersion: 1;
  repoId: string;
  nodeId: string;
  fullName: string;
  eligibility: 'public' | 'unavailable' | 'out_of_scope' | 'unknown';
  attemptState: 'success' | 'partial' | 'error';
  observedAt: string;
  lastPublicVerifiedAt: string | null;
  payloadHash: string | null;      // 不可变内容缓存的引用
  configState: 'absent' | 'valid' | 'invalid' | 'fetch_error';
  mode: 'basic' | 'enhanced';       // 当前实际使用内容的模式
  releaseState: 'present' | 'none' | 'stale' | 'error';
  lastContentSuccessAt: string | null;
  warnings: string[];             // 仅管理端可见的安全错误码
};

type PublicProject = {
  id: string;
  slug: string;                   // gh-<repoId>，系统推导
  title: string;
  summary: string;
  // 安全正文、截图、链接、技术栈、GitHub 事实、Release 的白名单投影
  // 不包含 updatedBy、原始配置、任务、错误详情和 token
};
```

`DisplaySettings` 不嵌入 GitHub 来源对象；Worker 不通过展开合并对象来保存设置。发布门禁实时读取设置与来源状态。`featured` 的来源与博客 frontmatter 的同名字段完全分开。

公开条件统一为：设置存在且 `visible=true`，最新来源观察证明仓库公开且 owner 在许可范围，公开状态验证仍在有效期内，不存在未确认的下架事件，并且有可用内容。任何条件不满足均不能从旧首页、API 或搜索缓存中补回该作品。

### 4.2 基础模式

1. Worker 分页枚举公开仓库，按数字 ID 去重，写候选清单；缺少设置的仓库按隐藏处理。
2. 管理员可以直接选中一个没有特殊 Topic、没有作品配置文件的仓库展示或精选。
3. Worker 确认公开状态，读取仓库名称、Description、Topics、language、homepage、README 和最新正式 Release。
4. 名称作为标题；Description 作为摘要；Description 缺失时，从 README 抽取第一个有效文本段，去除徽章、代码、图片及链接语法，按 Unicode 字符截断至 180 字；仍为空则用“项目资料见 GitHub 仓库。”。
5. README 经安全 Markdown 渲染作为正文，缺失时只展示已知介绍、技术信息和仓库链接；没有 README 不判定配置错误。
6. 读取增强配置得到“确认不存在”时进入基础模式；没有配置不影响人工精选，也不影响 Releases 下载展示。

### 4.3 增强模式

1. 用户从 `/portfolio-guide/` 或管理页复制提示词，在项目本地交给 AI。
2. AI 获取公开规范，检查真实代码、README 和可运行界面，生成可选配置、介绍 Markdown 和必要截图/素材。
3. 文件进入项目默认分支后，下一次同步发现 `.portfolio/portfolio.json`，锁定默认分支 commit SHA 后读取整组文件。
4. JSON Schema、路径约束、素材存在性、Markdown 清洗全部通过才形成新的有效增强内容；缺少字段按明确规则回退至基础资料。
5. 管理层最后合成发布结果。配置合法也不会自动展示、精选或修改排序。
6. 配置损坏保留上一份有效增强内容；首次配置就损坏时继续使用当前基础内容并在管理页报错。
7. 配置文件被确认删除时视为主动退出增强模式，回到最新基础内容；只有网络失败或读取错误才保留旧增强模式。

## 5. 作品配置协议 v1

### 5.1 文件位置与最小示例

基础模式没有任何文件要求。增强模式固定入口为默认分支的 `.portfolio/portfolio.json`，其他文件按引用读取，不遍历全仓库、不执行仓库脚本。

```json
{
  "$schema": "https://www.posase.im/api/portfolio/schema/v1.json",
  "schemaVersion": 1,
  "title": "项目真实名称",
  "summary": "基于实际代码和 README 描述项目用途。",
  "bodyFile": ".portfolio/overview.md",
  "features": ["已经实现并能证实的功能"],
  "techStack": ["TypeScript"],
  "links": { "docs": "https://example.com/docs" },
  "cover": {
    "path": ".portfolio/assets/cover.webp",
    "alt": "真实项目界面的概览"
  }
}
```

示例中的域名、功能和图片必须替换为真实项目资料；没有这些资料时删除对应字段。仅 `{"schemaVersion":1}` 也合法，表示使用基础默认内容的增强配置。截图不是必填项，不为了通过 Schema 生成虚假界面。

### 5.2 规范性 JSON Schema

实现时将以下 Schema 保存为 `src/lib/portfolio/schema/v1.json`，用 AJV 2020 + formats 校验；发布 API 直接输出此文件。生成类型或契约测试保证 TypeScript 类型不与 Schema 漂移。JSON Schema 的 `default` 是注释语义，默认值由独立 normalizer 实际应用。

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://www.posase.im/api/portfolio/schema/v1.json",
  "title": "Portfolio Content v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["schemaVersion"],
  "properties": {
    "$schema": { "const": "https://www.posase.im/api/portfolio/schema/v1.json" },
    "schemaVersion": { "const": 1 },
    "title": { "type": "string", "minLength": 1, "maxLength": 80 },
    "summary": { "type": "string", "minLength": 1, "maxLength": 240 },
    "bodyFile": { "$ref": "#/$defs/markdownPath" },
    "features": {
      "type": "array", "maxItems": 8, "uniqueItems": true,
      "items": { "type": "string", "minLength": 1, "maxLength": 120 }
    },
    "techStack": {
      "type": "array", "maxItems": 20, "uniqueItems": true,
      "items": { "type": "string", "minLength": 1, "maxLength": 40 }
    },
    "links": {
      "type": "object", "additionalProperties": false,
      "properties": {
        "website": { "anyOf": [{ "$ref": "#/$defs/httpsUrl" }, { "type": "null" }] },
        "demo": { "anyOf": [{ "$ref": "#/$defs/httpsUrl" }, { "type": "null" }] },
        "docs": { "anyOf": [{ "$ref": "#/$defs/httpsUrl" }, { "type": "null" }] }
      }
    },
    "cover": { "anyOf": [{ "$ref": "#/$defs/image" }, { "type": "null" }] },
    "screenshots": {
      "type": "array", "maxItems": 6,
      "items": { "$ref": "#/$defs/image" }
    },
    "additionalDownloads": {
      "type": "array", "maxItems": 5,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["label", "url", "kind"],
        "properties": {
          "label": { "type": "string", "minLength": 1, "maxLength": 50 },
          "url": { "$ref": "#/$defs/httpsUrl" },
          "kind": { "enum": ["store", "package", "external"] },
          "description": { "type": "string", "maxLength": 160 }
        }
      }
    }
  },
  "$defs": {
    "httpsUrl": {
      "type": "string", "format": "uri", "maxLength": 2048,
      "pattern": "^https://"
    },
    "markdownPath": {
      "type": "string", "maxLength": 240,
      "pattern": "^\\.portfolio/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+\\.md$"
    },
    "imagePath": {
      "type": "string", "maxLength": 240,
      "pattern": "^\\.portfolio/assets/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+\\.(?:png|jpg|jpeg|webp)$"
    },
    "image": {
      "type": "object", "additionalProperties": false,
      "required": ["path", "alt"],
      "properties": {
        "path": { "$ref": "#/$defs/imagePath" },
        "alt": { "type": "string", "minLength": 1, "maxLength": 160 },
        "caption": { "type": "string", "maxLength": 200 },
        "width": { "type": "integer", "minimum": 1, "maximum": 10000 },
        "height": { "type": "integer", "minimum": 1, "maximum": 10000 }
      }
    }
  }
}
```

语义校验补充：字符串 trim 后不能空；拒绝重复 JSON 键；URL 禁止用户名密码、回环/私网地址及非 HTTPS 协议；路径按仓库根目录解释，拒绝百分号编码绕过、`..`、反斜线、符号链接、子模块、LFS 指针替代素材。`width`/`height` 必须同时提供且与实际图片元数据相符，否则省略尺寸或报对应字段错误。配置上限 32 KiB，增强正文 128 KiB，单图 2 MiB，6 张图合计 8 MiB；验证这些限制时不得把图片二进制保存到 KV。

### 5.3 默认值、缺失、清空与覆盖

| 字段/数据 | 增强覆盖与默认规则 |
| --- | --- |
| `title` | 非空增强值 > GitHub `name` |
| `summary` | 非空增强值 > Description > README 文本摘要 > 固定缺省句 |
| `bodyFile` | 有效引用 Markdown > README；省略表示使用 README，空字符串无效 |
| `features` | 增强数组整体替换，默认 `[]`；不自动推断尚未实现功能 |
| `techStack` | 增强数组整体替换；省略时仅使用已知 GitHub language，未知为空；`[]` 明确隐藏 |
| `links.website` | 增强 HTTPS URL > 经校验的 GitHub homepage；`null` 明确隐藏；省略则回退 |
| `links.docs/demo` | 增强有效 URL，否则无；`null` 隐藏 |
| `cover`、`screenshots` | 默认无封面、`[]`；`cover:null` 明确无封面；列表整体替换，不与旧配置拼接 |
| `additionalDownloads` | 默认 `[]`；只补充真实外部渠道，不能覆盖 Releases 附件或声明版本 |
| GitHub Topics | 始终来自 GitHub Topics，作为标签；增强技术栈不冒充真实 Topics |
| GitHub owner/name/URL/ID/license/stars/fork/archived | 始终来自 GitHub，不能被配置覆盖；未知字段不展示 |
| version/publishedAt/releaseNotes/assets | 只来自 Releases，不开放配置字段 |
| visible/featured/order/slug/canonical/status | 不属于增强协议；根级或嵌套未知字段使整个配置校验失败 |

先独立生成基础内容，再对本次完整有效增强配置应用覆盖。**不能把新配置缺失的字段从上一份增强配置深合并回来**，否则删除字段无法生效。只有整份新配置无效时才保留上一份完整有效增强内容。增强内容的 LKG（上一份有效内容）与最新 GitHub 事实、Release 缓存分开：坏配置不应冻结仓库名称、公开状态或新版本。

模式字段由系统判断：配置缺失为 basic；有效配置为 enhanced；坏配置且有旧增强内容时 effective mode 仍为 enhanced，另报 `configState=invalid`；坏配置且无旧增强内容为 basic + 错误。不得让配置自报发布状态或有效性。

## 6. 公开规范 API 与可复制 AI 提示词

### 6.1 规范 API

`GET /api/portfolio/spec.json` 返回版本化协议目录，包含：`currentVersion:1`、`schemaUrl`、`schemaSha256`、`promptUrl`、`guideUrl`、入口文件路径、所有容量限制、字段所有权、默认规则、基础/增强模式说明、合法/非法示例和“文件不影响发布状态”的明确说明。它是公开内容规范，不提供仓库写入或网站发布能力。

`GET /api/portfolio/schema/v1.json` 返回上述 Schema，`Content-Type: application/schema+json; charset=utf-8`。`GET /api/portfolio/prompt.txt` 返回 UTF-8 纯文本。三个端点支持 GET/HEAD、ETag、`Cache-Control: public,max-age=3600`，仅这组公开规范允许 `Access-Control-Allow-Origin: *`，不携带凭据。

v1 语义冻结；不兼容改动新增 v2 和对应 Schema URL。客户端不得自动执行规范中的命令。JSON Schema 加载器不跟随任意 `$ref` 到外部地址，防止校验引入 SSRF。公开页面同时给出最小配置和只含真实资料的完整示例；增加契约测试验证示例确实合法。

### 6.2 用户实际复制的提示词

```text
请读取 https://www.posase.im/api/portfolio/spec.json 及其 v1 Schema，
分析当前项目的真实代码、README 和可运行界面，为我的作品网站生成可选增强资料。
按规范创建 .portfolio/portfolio.json，必要时创建 .portfolio/overview.md
和 .portfolio/assets/ 中的真实截图或明确标注为示意的素材。
只描述已实现并能证实的能力；无法运行截图时省略截图，不虚构效果。
字段允许省略，不确定的文案、网址和素材不要编造。
不要写展示开关、精选、排序、slug、版本、发布日期、Release Notes 或发布附件链接；
发布设置由网站管理页决定，版本与附件由网站读取 GitHub Releases。
只有项目确有特殊外部下载渠道时才填写 additionalDownloads。
最后校验配置，列出生成文件、资料依据和仍需人工核实的地方。
若无法获取规范，请报告原因，不要猜测协议或自动提交、推送、发布。
```

提示词中的站点域名来自 `SITE.website`，通过同一构建逻辑生成，避免示例域名与生产不一致。生成入口是可选的内容增强工具；用户不需要安装 Skill、MCP、仓库 Actions，也不需要把所有仓库改成增强模式。站点只检验数据，不信任“AI 已校验”的声明。

## 7. GitHub 读取、README 与 Releases 规则

### 7.1 凭据与请求范围

- 默认 owner 为 `jesongit`、类型为 user；在服务器配置 `GITHUB_OWNER` 和 `GITHUB_OWNER_TYPE`。若未来切换组织，改用组织公开仓库列表端点，不引入组织管理后台。
- 使用只读、仅需公共资源访问的细粒度 PAT；按 GitHub 当前规则给予必要的 Metadata/Contents 读取权限，避免私有仓库权限、写权限、Actions 权限或账号管理权限。新公开仓库必须可被候选枚举发现；用未手动选入 token 仓库清单的公开仓库验收这一点。
- Token 仅存 Sync Worker secret。Pages、浏览器、公开 JSON、构建时静态 API 均不持有 token。
- 所有 REST 请求固定 GitHub API host、`User-Agent`、合适的 `Accept` 和 `X-GitHub-Api-Version`；本计划采用当前文档的 `2026-03-10`，阶段 1 做端点契约确认并锁定，不使用隐式 latest。
- 正常请求串行，单请求超时 8 秒；响应大小分资源限制。遵守 `Retry-After`、`X-RateLimit-Remaining/Reset`；达到阈值暂停并留待后续 Cron，不在请求中持续睡眠。

### 7.2 端点与资源缓存

| 资源 | 请求与读取规则 | 默认重新验证频率 |
| --- | --- | --- |
| 候选池 | `GET /users/{owner}/repos?type=owner&per_page=100&sort=full_name`；组织使用 `/orgs/{org}/repos?type=public`；按 Link 完整分页并按 ID 去重 | 每 6 小时，手动全量任务可提前 |
| 仓库事实/公开性 | `GET /repos/{owner}/{repo}`；验证响应 ID、owner、`private=false`；处理 GitHub API 同域重定向 | 已展示/待展示每 10 分钟；普通隐藏候选每 6 小时 |
| Topics | 优先仓库详情 `topics`；缺失时请求 `/repos/{owner}/{repo}/topics`；空数组是合法清空 | 每小时，独立条件请求 |
| 默认分支 | 读取 `default_branch`，再解析该分支当前 commit SHA；空仓库没有 commit 时仍支持基础卡片 | 内容同步时 |
| README | `/repos/{owner}/{repo}/readme?ref={commitSha}`，读取 path、sha、content；编码/媒体类型匹配；不保存过期 download_url | commit 未变则复用；小时检查 |
| 增强配置及引用文件 | `/repos/{owner}/{repo}/contents/{path}?ref={commitSha}`；只读声明的安全路径；配置缺失做独立负缓存 | commit 未变复用；新 commit 立即重新判断 |
| 最新正式 Release | `/repos/{owner}/{repo}/releases/latest`；独立于默认分支与 `pushed_at` 检查 | 每小时；手动任务可绕过应用层间隔 |
| Release 附件 | 对选定 Release 的 `assets_url` 分页获取全部附件，必要时请求 `/releases/{id}/assets` | 随 Release 小时检查，即使 tag 不变也要检查附件变化 |
| 重命名异常恢复 | 先完整候选池按数字 ID 匹配；旧地址指向其他 ID 时，用已存 `node_id` 的 GraphQL `node` 定位原仓库 | 仅名称异常/404 时 |

资源缓存键由 API 版本、URL（含查询）、Accept 和鉴权范围标识组成；**不得把明文 token 放入 key**。保留 ETag、Last-Modified、body hash、fetchedAt、lastValidatedAt、status、retryAt。304 必须对应同一资源的已有 body；若 body 丢失，执行一次无条件 GET，不能把空响应当有效内容。README 304 不能推断 Releases 也没变；配置 404 也不能推断仓库被删除。

认证的条件请求可节省主要限额，分页应跟随 Link，限流应遵守响应头而非盲目重试。[GitHub REST 最佳实践](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)

GitHub 内容 API 的下载 URL 可能过期，且大文件有特殊限制；本站采用更小的应用限制，并使用固定 commit 的仓库路径作为持久引用。[GitHub 内容 API](https://docs.github.com/en/rest/repos/contents)

### 7.3 README、Markdown 与图片安全

同步 Worker 使用适合 Workers 的 Markdown 管线（建议 unified、remark-parse、remark-gfm、remark-rehype、rehype-sanitize、rehype-stringify），禁止 raw HTML、MDX、脚本、iframe、表单、style、事件属性、危险协议和任意代码执行。GitHub README 和 Release Notes 都按不可信外部内容处理，不因来自本人仓库而跳过清洗。

相对文本链接按文件目录解析到同 commit 的 GitHub `blob` 页面，图片解析到同 commit 的 raw URL；正确处理根路径、锚点、空格与 Unicode，禁止路径逃逸。增强图片只允许本仓库 `.portfolio/assets/` 下规定格式；README 远程图片只显示允许的 HTTPS 图片来源，无法信任的第三方徽章或图片转为链接/替代文本。网站不开放任意 URL 的图片代理，不对增强链接执行服务器探测；需要校验的 GitHub 资源只能请求许可 host，禁止带 token 跟随跨域重定向。

普通 README 原文上限 256 KiB，超出时截取安全文本边界并显示“在 GitHub 阅读完整说明”；增强正文超过上限则配置失败，不静默截断。清洗后的正文缓存 HTML 和纯文本摘要，记录 sanitizerVersion，升级清洗器时重新处理旧缓存。外链增加 `rel="noopener noreferrer"`，JSON-LD 序列化转义 `<`，所有普通字段用模板自动转义。

### 7.4 Release 与多平台下载

“最新正式版本”采用 GitHub `/releases/latest` 的定义，不自行按 tag 的字符串/semver 排序；正式版本必须 `draft=false`、`prerelease=false`。展示版本用 `tag_name`，发布时间用 `published_at`，说明用清洗后的 `body`；不把 `created_at` 当发布时间，也不从 README、package.json 或 AI 文案推断发布版本。GitHub 文档说明 latest 的排序依据与发布时间并不等价。[GitHub Releases API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release)

- `latest=404` 且同轮仓库仍确认公开：记录 `release=null`、`releaseState=none`，移除旧版本和附件。不能永久保留已删除的 Release。
- API 超时/限流/5xx：保留上次 Release，标注管理端为 stale；公开侧最多复用 24 小时且必须仍通过仓库公开门禁，超过后不展示版本或附件，保留 GitHub 仓库链接。
- 没有正式 Release、只有预发布或只有 Git tags：不显示版本、发布时间或 GitHub 下载按钮。
- 有 Release 但没有附件：显示正式版本、说明和“查看 Release”，不生成平台下载。GitHub 自动 source zip/tar 可单列“源代码”，不能作为安装包。
- 只接受 `state=uploaded` 的真实附件，保存 `id/name/label/size/content_type/browser_download_url/updated_at`；直接链接 GitHub，不在 KV 保存二进制、不拼接猜测 URL。
- 从实际名称、扩展名和 MIME 识别平台与架构：Windows（exe/msi 或明确 win/windows）、macOS（dmg/pkg 或 mac/darwin）、Linux（AppImage/deb/rpm 或明确 linux）；架构识别 x64/amd64/x86_64、arm64/aarch64、x86/ia32、universal。
- 通用 zip/tar.gz 没有平台线索时归“其他附件”；冲突线索归未知并保留原名，不能猜。校验和、签名、SBOM 等归“校验与其他文件”，不作为推荐安装包。
- 多平台均可见，设备识别最多默认展开一个分组，不自动下载，不隐藏其他平台。
- `additionalDownloads` 单独显示“其他获取渠道”，用“前往商店/包管理器/外部渠道”等真实标签；无 Release 时也不能伪装成 GitHub 版本下载，不提供 AI 编造的版本字段。普通 GitHub Release 附件无需任何增强配置。

## 8. Worker、Cron、KV 与并发策略

### 8.1 KV 命名空间和键

初版使用 3 个 KV namespace，生产与预览各一套。它们仍是同一 KV 技术，不引入数据库。Cloudflare binding 本身不提供这里的字段级读写约束，以下写入权限由模块接口与测试保证。

| namespace/key | 内容 | 写入方 / 生命周期 |
| --- | --- | --- |
| CONTROL `v1:settings:<repoId>` | DisplaySettings，默认缺失即隐藏 | 仅经过 Access 的管理 API；不设 TTL |
| CONTROL `v1:audit:<time>:<uuid>` | 人工变更的字段白名单、前后 revision、Access sub | 管理 API；保留 90 天，无 token/正文 |
| CACHE `v1:inventory:<reverseTime>:<runId>` | 完整候选仓库 ID/当前名称清单，含分页完成标记 | Sync Worker；保留最新两份完整清单；无完整清单不做批量移除 |
| CACHE `v1:obs:<repoId>:<reverseTime>:<runId>` | 单仓库来源观察及内容引用；本次所有子请求的结果摘要 | Sync Worker；不可变；至少保留当前与上一有效观察 |
| CACHE `v1:payload:<sha256>` | 基础内容、增强 LKG、清洗文本/HTML、独立 Release 值及来源 hashes | Sync Worker；内容寻址，不可变，引用存在则不设 TTL |
| CACHE `v1:incident:<repoId>:<reverseTime>:<uuid>` | 仓库失去公开资格的撤下事件，原因、发生时间、身份 | Sync Worker；小型墓碑长期保留，不因清理内容而删除 |
| CACHE `v1:http:<hash>` | 单端点 ETag、响应体/引用、负缓存、限流重试时间 | Sync Worker；可重建缓存，按资源回收 |
| CACHE `v1:run:<runId>` | 阶段、游标、统计、耗时、失败摘要、下次执行时间 | Sync Worker；日志 30 天，当前未完成任务保留 |
| JOBS `v1:request:<uuid>` | 手动任务范围、repoId、requester、createdAt、expiresAt | 管理 API 创建，不把 GitHub token 放入任务 |
| JOBS `v1:result:<uuid>:<runId>` | queued/running/succeeded/partial/failed 等状态及结果 | Sync Worker；完成后 30 天 |

`reverseTime` 用固定宽度的反向毫秒时间编码，使 KV 按字典序列出时新记录在前。读取方按语义时间及唯一 ID 选择最新记录，不使用会被晚完成旧任务覆盖的 `current` 指针。KV list 仍须处理 `cursor`、`list_complete`，不能假设单页就是全部。[KV 列表规则](https://developers.cloudflare.com/kv/api/list-keys/)

inventory只供发现和管理候选；公开作品先从CONTROL中读取已选择的ID，再按ID查询来源，不能因inventory临时缺失把全部作品当成删除。公开页面批量读取设置，并限制并行KV读取数量；来源最新观察/incident只保留必要的管理索引信息，正文按当前页需要读取。每个候选的错误不阻止其他候选进入完整inventory，但分页网络失败意味着该次inventory不完整。

初版规模目标：最多 500 个候选、50 个展示作品；管理 API 分页，公开列表每页 12 项。未展示候选只同步基础元数据，首次选中或管理员请求时读取完整内容。容量或请求预算达到阈值时分批继续，不静默截断候选池或把截断当删除。每个 payload 设应用上限 512 KiB，超过则按资源限制裁剪基础 README/Release Notes或拒绝无效增强内容；单个 Release 附件清单超过预算时分页并只给真实 Release 链接，不伪称已列全。

### 8.2 定时与手动同步

使用一个 `* * * * *` Cron，每分钟判断到期任务，默认不在每次 tick 扫描 GitHub：

1. 先处理已展示/待展示仓库的公开状态检查和手动单仓库任务。
2. 每小时处理展示仓库的完整内容/Release 条件同步；每 6 小时重建候选池。
3. 管理员点击同步写入 JOBS，API 返回 `202 + jobId`；前端显示“已排队”，不能伪称同步已完成。正常情况下目标 1–2 分钟开始执行，受 KV 传播、预算和限流影响。
4. 单 tick 工作预算 40 秒，每个 GitHub请求超时 8 秒，预留记录检查点时间；未完成工作保存游标后下一 tick 继续。每 tick 默认最多 30 次上游请求，所有 GitHub请求串行。
5. 任务执行使用 `scheduledTime` 形成逻辑批次 ID。重复投递和重复手动请求允许重复读取，但结果必须幂等；按仓库合并重复任务，多个 jobId 可关联同一运行。
6. 设置每用户手动全量同步 10 分钟冷却、单仓库 60 秒冷却；服务端返回 `429 + retryAt`。KV 冷却是尽力防重复，边缘限流规则承担请求洪泛防护，不把 KV 计数当严格原子限流。
7. 执行即将超时前不得再开始新资源读取；卡住的 running 状态 5 分钟后标为 interrupted 并可重试，不能依靠 `waitUntil` 无限延长 HTTP 请求后台任务。

任务默认有效期24小时，超过仍未执行则记录expired并要求用户重新触发；过期不是成功。任务读取按jobId收集关联run结果，终态不能被同一run迟到的running进度降级。相同逻辑批次的重复来源写入使用确定性的运行标识和内容hash去重，不依赖KV锁。

Cron 使用 UTC，管理页转换为 Asia/Shanghai；设置或修改 Cron 可能有传播延迟，部署验收需观察真正的 scheduled 事件。[Cloudflare Cron 文档](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

### 8.3 发布一次单仓库观察的顺序

1. 读取最新来源观察和增强 LKG；独立读取人工设置只决定任务优先级，不复制或保存设置。
2. 请求并核对仓库身份和公开资格；不合格立即写撤下事件，不等待 README/Release 成功。
3. 在固定 commit SHA 下读取 README/配置/引用，独立读取 Release；各资源失败分别回退或报错。
4. 生成新的内容寻址 payload；配置错误复用原增强内容引用，但新 GitHub事实/Release 可独立更新。
5. 提交前再验证仓库公开资格。`observedAt` 取这次资格请求的开始时间，不取慢任务完成时间；请求超时不续期公开资格。
6. 先写 payload，再写完整不可变 observation。引用尚未传播可暂时返回 503/省略卡片，不能凭空合成正文，也不能无条件回退到已被撤下的旧观察。
7. 若观察为 unavailable/out_of_scope，同时写不可变 incident；公开门禁既检查观察状态也检查 incident，不能仅依赖一个来源。
8. 最后写运行结果。payload 写入后进程退出只产生可回收孤儿对象，不让半成品变成当前内容。

如果资格请求遇到401、限流、超时或5xx，`attemptState`记错误，沿用上次确定的eligibility和原`lastPublicVerifiedAt`，不得刷新有效期；从未有过确定结果才使用unknown。这样“本次请求失败”和“最后已知资格”保持分离，允许资格尚未过期的旧公开内容短暂继续服务，也不会把已知unavailable因一次网络故障改回public。

### 8.4 KV 一致性与冲突：必须诚实实现

KV 不提供跨 key 事务或 compare-and-swap；`get(lock)` 后 `put(lock)`、`revision` 比较、单进程互斥都不是跨地区锁。不能在计划实现中声称“加一个 KV 锁就绝无并发”。其他地区通常需要约一分钟或更久才能看到更新，负缓存也会传播延迟。[KV 一致性说明](https://developers.cloudflare.com/kv/concepts/how-kv-works/)

- **设置与同步隔离是硬保证**：Sync Worker 的存储封装没有 CONTROL 写方法，测试断言其 KV put/delete 从不作用于设置空间。因此即使同步重试也不会覆盖精选和排序。
- **来源并发**：只由 scheduled 路径生成来源观察；不允许手动 API 另开同步写路径。观察、撤下事件采用不可变 key；晚完成的旧观察在可见集合中不会挤掉时间更新的观察，墓碑也不会被旧 payload 覆盖。
- **人工并发**：初版面向单管理员串行操作，UI 单个仓库保存期间禁用重复保存，多个仓库按序保存。请求携带已读 revision；发现不匹配返回 409，但明确这是尽力冲突检测。两个地区同时读到同一旧 revision 仍可能最后写入获胜，审计保留两次操作；不承诺多管理员强一致编辑。
- **下架与恢复**：撤下事件有独立 incidentId。仓库再次公开时，只更新来源，不能自动恢复网站展示；管理员明确重新展示并确认最新 incidentId 后才恢复。此字段由管理服务端按当前事件生成，AI 无权提供。
- **排序**：按 `order` 升序、repoId 数字升序稳定排序；首页先筛 `featured` 再使用同样顺序。批量重排逐条返回结果，部分失败显示具体未保存项；不能宣称多 key 保存原子成功。
- **清理**：只清理至少 48 小时前的无引用 payload，先标记引用再延迟复核；上一份有效增强内容不因连续配置错误过期。墓碑和设置不参与普通缓存 GC。
- **传播体验**：管理端先显示服务端确认保存的 revision，并提示“正在传播”；跨地区读回旧值时不能把界面回滚成旧设置。写入成功与全球生效是两个状态。

上述措施保证最终收敛与来源/设置不互相覆盖，不能消除 KV 的读陈旧窗口。上线前至少从两个地区验证隐藏的传播时间，目标在正常状态下两分钟内消失；这是运维目标，不是平台严格上限。紧急撤下使用 Cloudflare 边缘规则暂时阻断该作品路由；需要连首页、搜索摘要一起立即消失时临时关闭全部作品动态入口，静态文章照常可用。不能只清 CDN 后宣称 KV 已全球更新。

## 9. 发布门禁、稳定 URL 与异常状态机

### 9.1 稳定身份与 URL

公开 canonical 为 `https://www.posase.im/projects/gh-<repoId>/`，slug 不接受 AI 配置或管理页自由修改。解析 slug 后从数字 ID 寻找设置和来源，不通过 URL 中的仓库名搜索。保留原博客 `/posts/<分类>/<slug>` 不迁移。

仓库重命名时更新 `fullName`、GitHub 链接和资料，数字 ID、URL、人工设置保持不变。旧仓库名被新仓库占用时比较返回 ID：新 ID 是全新隐藏候选，不能继承旧作品。必要时通过 `node_id` 的 GraphQL node 查询恢复原身份；若 GraphQL 返回错误，不能把错误当确定删除。[GitHub 全局 node ID](https://docs.github.com/en/graphql/guides/using-global-node-ids)

按旧名称请求返回404或不同ID时，先在本轮预算内完成身份恢复：若找到相同ID且仍公开，按正常重命名处理，不产生撤下incident；确认不可公开访问才记录incident。若恢复请求只是网络/限流失败，则是unknown尝试，依照已有资格的30分钟有效期处理，不能把单纯“旧名称不存在”直接记成原仓库永久删除。

仓库转移到 `GITHUB_OWNER` 之外默认撤下，保留 ID 与设置记录供管理员查看，不自动扩大同步账号范围。没有旧作品系统可迁移，因此不实现尚不存在的旧路径兼容；仅规范尾斜线、大小写和非法 slug，对真实 canonical 做必要的 308 跳转。

### 9.2 异常动作表

| 事件 | 内部处理 | 公开行为 | 恢复条件 |
| --- | --- | --- | --- |
| 新发现公开仓库 | 仅写候选，设置默认隐藏 | 不出现在任何公开列表/详情/搜索 | 管理员显式展示 |
| 管理员取消展示 | CONTROL 写 `visible=false`，清除 UI 的有效精选显示 | 门禁拒绝；详情 404/noindex，列表、搜索、sitemap 移除 | 管理员再次展示且来源合格 |
| 正常重命名且 ID 一致 | 更新资料和名称 | 原 URL 继续 200 | 无需重新精选 |
| 旧名称被不同 ID 使用 | 独立候选；原 ID 单独核实 | 不把新项目挂到旧 URL | 原 ID 恢复或新 ID 人工展示 |
| 仓库元数据 `private=true` | 即使 token 看得到，也写 unavailable + incident，停止内容读取 | 全面撤下，不返回旧介绍或下载 | 再公开 + 明确确认 incident |
| 仓库端点 404/410 | 完整候选池和 node ID 辅助核对；当前先记不可公开访问，撤下 | 404/noindex；不泄露“私有”详情 | 确认同 ID 公开 + 人工恢复 |
| 账号外转移 | out_of_scope + incident | 撤下 | 明确调整许可范围后人工恢复 |
| 单页枚举失败/分页未完成 | 不提交完整新 inventory，不按缺失做批量删除 | 已展示仓库仍按逐仓库资格判断 | 完整枚举成功 |
| README 不存在/空仓库 | 合法基础空正文 | 有实际摘要和仓库链接，无假内容 | 上游补充资料自动生效 |
| 配置不存在 | basic | 仍可展示和精选 | 添加合法配置后 enhanced |
| 配置删除且仓库存在 | 清除增强覆盖，使用新基础内容 | 平滑降级，无需改发布设置 | 再次添加合法配置 |
| JSON/Schema/引用文件错误 | 不替换增强 LKG，记录路径化错误 | 有 LKG 用旧有效增强；无 LKG 用基础内容 | 配置修复 |
| 配置/README超时、5xx | 分资源使用已有有效内容 | 公开资格仍新鲜时可继续展示 | 下一次成功同步 |
| GitHub 401/token失效 | 全局 credential_error，禁止盲重试，不认作全仓库删除 | 只在公开验证有效期内使用旧内容；到期暂停作品 | 修复 token，重新核验 |
| GitHub 403/429限流 | 分类 rate_limit；按头延后，保留缓存 | 同上，不写“已删除”墓碑 | 冷却后重试成功 |
| Release已删除或无正式版 | 仓库确认公开后，把 Release 缓存置空 | 立即按传播进度移除旧版本与附件 | 新正式 Release |
| 引用 payload未传播/KV读取失败 | 不将其解释为无项目或配置缺失 | 详情503+Retry-After；列表显示暂时不可用，不泄露旧撤下内容 | 缓存恢复可读 |

仓库公开资格默认有效期为 **30 分钟**，10 分钟检查一次。304 可以续期对应的资格验证；限流、超时、401 和未知错误不能续期。资格到期时作品暂时不公开：详情返回 503/noindex，首页/列表不输出该作品内容并提示资料暂时不可用，sitemap 在无法可靠计算时返回 503，不用一个空 sitemap 冒充全部被删除。

30 分钟是在“同步故障保持可用”和“转私有后不能无限期泄露缓存”之间选择的保守上限。正常删除/转私有的发现目标为 10 分钟检查周期加 KV 传播时间；配置错误可以长期保留旧增强内容，但**只有资格持续被成功核验为公开时**才可继续展示。KV 传播本身没有严格全球上限，不能把 30 分钟说成严格的全网撤回 SLA。

发布门禁同时用于首页、列表、详情、动态搜索、公开 API、动态 sitemap，以及任何后续增加的 JSON/图片派生接口。禁止公开 `/raw-cache`、历史 payload 或任意 repoId 的未过滤 JSON。错误页面不回显仓库敏感状态、请求 token、原始 GitHub 错误体或内网配置。

## 10. 管理页、Access 与写入 API 安全

### 10.1 管理页功能

- 候选列表按仓库名/Description 搜索，筛选已展示、隐藏、精选、basic/enhanced、配置错误、同步异常；展示 fork/archived 提示，不强制排除。
- 逐仓库切换展示/隐藏、精选；提供数字排序和上下移动按钮，支持键盘；首页精选数默认上限 6，超出按管理顺序取前 6 并明确提示。
- 仓库摘要、GitHub 链接、固定站内地址、模式、当前 Release、配置校验结果、最后成功内容同步时间、最后公开状态验证时间、下次计划时间。
- 全量同步、单仓库同步、任务进度和部分失败列表；限流时显示下次可重试时间。
- 提供复制 AI 提示词与公开规范链接；基础模式卡片直接可用，不提示“必须添加配置”。
- 下架事件与重新公开分开显示；确认恢复必须显式保存。离开有未保存变更的页面时提示，保存后保持客户端确认的 revision。
- 初版不增加富文本编辑器、素材上传、项目介绍数据库、角色系统或 GitHub 远程写入。

### 10.2 管理 API 契约

| 方法/路由 | 行为与限制 |
| --- | --- |
| `GET /api/admin/repos?cursor=&q=&status=` | 鉴权候选列表，分页100以内；仅管理端可看隐藏和异常状态 |
| `GET /api/admin/repos/[repoId]` | 当前设置、来源摘要、校验错误、incident、revision；原始配置最多安全节选 |
| `PATCH /api/admin/repos/[repoId]/settings` | 仅接受 visible/featured/order、已读 revision；恢复 incident 由服务端验证并记录 |
| `POST /api/admin/reorder` | 有序 repoId 数组及各项 revision；重复/未知 ID 拒绝，逐项结果明确成功/失败 |
| `POST /api/admin/sync` | body 为 scope=all 或 scope=repo+repoId；创建 JOBS，202+jobId，无任意 URL/owner |
| `GET /api/admin/sync/[jobId]` | 返回任务状态、计数、错误码、retryAt；UI 前台运行时每5秒轮询，完成即停止 |
| `GET /api/admin/session` | 已验证的显示身份、短时 CSRF token、服务器时间；不返回 Access JWT |

统一错误结构 `{code,message,requestId,fieldErrors?,retryAt?}`，JSON body 不超过 16 KiB，修改请求拒绝未知字段，错误码区分 400/401/403/404/409/422/429/503。设置成功返回写入确认的对象和 revision，不立即读回陈旧 KV 覆盖结果。

### 10.3 Cloudflare Access 配置

1. 建立 self-hosted Access application，覆盖正式域名的 `/admin`、`/admin/*`、`/api/admin`、`/api/admin/*`，避免只保护页面不保护 API，或漏掉无尾斜线路径。
2. 使用明确的管理员邮箱 allow policy，拒绝其他身份；不配置 Bypass/Everyone。管理页与 API 使用同一个可接受的 application audience；将真实 team domain、audience 保存为运行环境配置。
3. Pages 预览部署使用独立 Access 应用及测试邮箱，绝不绑定生产 KV。`*.pages.dev` 和分支预览域名即使没有正确的边缘 Access 拦截，也必须被服务器 JWT/host 校验挡住。
4. 列出所有项目别名和接入域名，禁止通过未保护的 hostname 调用管理接口。Sync Worker 无公开管理入口，不依赖请求头伪装“来自 Cron”。

### 10.4 服务端验证与 CSRF

在 `src/middleware.ts` 对管理路径运行鉴权，处理所有方法，在渲染页面或执行写入前：

- 从 `Cf-Access-Jwt-Assertion` 取 JWT，用固定 `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` 的 JWKS 验签，校验 issuer、application aud、exp、nbf 和允许的签名算法。用 `jose` 的 Web Crypto 实现；缓存 JWKS 并处理 key rotation。
- 不能仅检查邮箱 header、Cookie 存在、`CF-Connecting-IP` 或 request host。无有效 JWT、JWKS不可用且无可用签名键时失败关闭；不信任 JWT 提供的任意 key URL。
- 检查站点 hostname 在 `ADMIN_ALLOWED_HOSTS` 中；校验已验证 identity 的邮箱在 `ADMIN_EMAILS` 中；测试 issuer正确但 aud错误、旧会话、伪造 header、未授权邮箱。
- 写请求严格验证 `Origin` 等于许可站点 origin；缺失或不匹配即403；要求 `Content-Type: application/json` 和 `X-Portfolio-CSRF`，拒绝跨站 `Sec-Fetch-Site`。
- CSRF token 由已鉴权 session endpoint 生成，以 `CSRF_SECRET` HMAC 签名，绑定 Access sub、允许 origin、随机 nonce、10分钟到期；写 API验签且与当前 JWT identity 对齐。token只驻留当前页面内存。
- 管理 API不允许跨域凭据 CORS；GET/HEAD 不做任何修改；OPTIONS 不绕过鉴权执行写入。公开规范 API的 `*` CORS不能复制到管理 API。
- 所有管理响应设置 `Cache-Control: private,no-store`、`X-Robots-Tag: noindex,nofollow`；错误响应也不得被 CDN缓存。响应头由 SSR代码设置，不能只依赖针对静态文件的 `_headers`。

Access 的 JWT 验证是应用端防止绕过保护入口的重要组成部分。[Cloudflare Access 验证 JWT](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)

生产不提供 `AUTH_DISABLED` 开关。自动测试使用本地生成的签名测试 JWT/JWKS 与假域名，且只在测试注入层替换验证依赖；浏览器里不能携带 GitHub、KV、Cloudflare 部署或 CSRF 签名 secret。

## 11. 页面改造与原博客保留

### 11.1 首页

`src/pages/index.astro` 改为 SSR；保留个人站点标识、简介、Socials 和原 RSS 链接。内容顺序：简短介绍 → 精选作品（最多6）→ 全部作品入口 → 最新文章（4篇）→ 置顶文章入口/摘要及全部文章入口。

首页**直接复用现有 `getCollection("blog")`、`getSortedPosts` 和 Card**，读取随部署打包的 Content Layer 构建快照，仅把过滤后的文章摘要传给模板。不另建博客同步缓存、Markdown解析器或第二份摘要生成协议；阶段1在真实Workers运行时验证该读取不依赖线上文件系统。Content Layer的构建快照可用于预渲染和按需渲染。[Astro Content Layer说明](https://astro.build/blog/content-layer-deep-dive/)

为防止SSR首页在未来某天列出尚未构建出HTML的定时文章，`astro.config.ts`在一次构建中注入固定`SITE_BUILD_TIME`，生产`postFilter`以该构建时间判断文章发布资格；所有静态页面和SSR首页使用同一值。开发模式保留原预览行为。到期文章仍需正常站点重建，沿用静态博客的发布模型，不能把Worker Cron误当文章自动发布器。草稿正文不得进入浏览器数据或公开摘要API。

精选为空时不自动精选 stars最多的项目，也不显示巨大空框；用已展示作品的普通列表和“全部作品”入口，标明它是普通作品，不冒充人工精选；作品服务整体不可用时保留首页文章区域，并给作品区域简短状态。

### 11.2 作品列表与详情

- 新增 `ProjectCard.astro`、`ProjectGrid.astro`、`ProjectDetails.astro`、`ProjectDownloads.astro`；继续使用现有 Header/Footer/LinkButton/Tag 的可复用展示样式。
- `/projects/` 首屏服务端输出卡片与 GET筛选表单；默认按人工顺序，每页12项。主题标签/技术栈可筛选，查询参数归一化，不以 stars替换人工顺序。
- 卡片内容为封面（可无）、标题、摘要、Topics/技术栈节选、真实 GitHub事实、可选最新版本；点击进入站内稳定详情。卡片图片懒加载，提供尺寸和 alt，缺图使用普通色块/文字而非伪截图。
- 详情模块固定为标题摘要、项目链接、主要能力、介绍正文、截图、技术信息、版本与下载；不存在的数据对应模块不渲染。基础模式也走完全相同的模板。
- 详情与下载区直接使用服务端投影，页面请求不直接调用 GitHub。当前版本缺失不输出占位 `v1.0.0`、`latest` 或空下载按钮。
- 展示端不把“配置校验失败”“PAT失效”等内部说明放入产品页面；这些留在管理端。必要的缓存状态可用“资料暂时无法更新”表达。
- 项目导航需要支持正常浏览器前进/后退、原站 `ClientRouter` 跳转和全页直达；返回按钮不误跳至之前的博客搜索状态。

### 11.3 原博客

保留 `/posts` 为博客主入口，不搬迁到 `/blog`；Header新增“作品”，文章、标签、归档、搜索和关于保留。文章 frontmatter、分类路径、日期显示、RSS内容与 OG地址不批量改名。文章和作品的 `featured` 是两个独立概念。

不编辑现有48篇 Markdown正文。阶段1修复的是内容过滤与构建入口，不修改文章写作内容；如后续另有文章编辑任务，再按 `BLOG_STYLE_GUIDE.md` 执行。

## 12. SEO、搜索与动态更新

### 12.1 SEO

- 修改 `Layout.astro` 支持明确传入 `structuredData`、`robots`、`ogType`；博客详情传 `BlogPosting`，首页用 `WebSite`/`Person`，作品列表用 `CollectionPage`，详情按实际项目用 `SoftwareSourceCode` 或 `CreativeWork`，不把所有仓库都编成可安装应用。
- 日期仅在真实来源存在时输出；不把最近一次同步时间当作品发布日期。源码项目可以输出 `codeRepository`，版本只在存在正式 Release时按合理类型输出，不添加虚假价格、评分、操作系统或下载量。
- canonical 使用固定 `SITE.website` 与规范路径构造，不接受任意 Host或增强字段覆盖。保留文章已有 canonicalURL能力。
- 新作品已有安全封面则用于 OG，否则复用站点默认OG；不把 Resvg搬到Worker请求时运行，不为每个仓库生成虚假截图。
- `@astrojs/sitemap` 继续只管理构建可知页面；过滤 admin、API、guide的非索引版本和异常路由。`robots.txt` 同时声明静态 sitemap-index和动态 sitemap-projects，加入 `/admin`、`/api/admin` 的 Disallow，明确 robots不是鉴权。
- 动态 sitemap只列当前可发布作品，lastmod取内容变化/真实Release更新时间，内容hash未变的同步不更新lastmod。设置变化仅影响纳入/移除及顺序，不人为刷新所有项目日期。
- 项目分页第一页canonical去除page=1；分页2及以后自指规范页；任意搜索/多重筛选组合 noindex,follow，避免重复抓取。所有不存在或撤下详情为真实404，临时基础设施故障503+Retry-After，不返回200空壳或统一重定向首页。

### 12.2 搜索

博客 Pagefind 继续索引 `dist` 中文章 HTML。`data-pagefind-body` 已把正文限定在文章详情；没有构建时 HTML 的 SSR作品不会自动进入索引。[Pagefind 索引范围](https://pagefind.app/docs/indexing/)

新增 `/api/projects/search?q=`：服务器读取通过发布门禁的作品，搜索标题、summary、Topics、techStack和截断的正文纯文本，按标题精确命中 > 前缀/子串 > 标签 > 正文排序，同分按人工order。中文采用NFKC归一化、大小写折叠与子串匹配，不引入外部搜索平台；q长度2–80字符，每次最多20项，固定预算。初版针对50个展示作品无需倒排数据库。

`search.astro` 保留现有 Pagefind UI及其query URL行为，新增“作品”结果区，与文章结果分组显示；不伪造两种搜索引擎之间的统一相关性分数。输入防抖250ms，取消旧请求，失败不影响博客搜索。作品结果不写 localStorage、Service Worker或长期客户端缓存；切页、重新搜索和页面恢复时重新获取。公开搜索不返回未展示、失效资格或未确认恢复的作品。

### 12.3 缓存政策

| 数据/响应 | 初版策略 |
| --- | --- |
| 博客静态HTML、Pagefind、构建OG | **复用**现有部署静态缓存与发布更新机制 |
| `/_astro/`指纹资源 | 静态长缓存，依靠hash换版 |
| 公开协议/提示词 | 1小时 + ETag；版本化Schema；发布时更新hash |
| 首页/作品HTML、作品JSON/搜索/动态sitemap | `Cache-Control: no-store`；禁用针对这些路由的Cache Everything、Cache API与SWR |
| 管理所有响应 | `private,no-store` + noindex |
| GitHub原始资源 | KV条件请求缓存，按资源独立续期；清洗文本与LKG保留引用 |
| KV发布设置/资格观察 | 每请求读取，使用平台允许的最低合适cacheTtl；不得声称HTTP no-store可关闭KV内部缓存 |

初版接受动态路由的Worker调用成本，以换取清晰的下架行为。先测量实际访问量、KV读取量和请求耗时，再讨论HTML缓存；任何后续缓存必须在每次响应前重新经过发布门禁，不能先命中整页缓存就跳过判断。

## 13. 环境变量、部署配置与本地命令

### 13.1 配置清单

| 名称 | 所在位置 | 类型/默认值与用途 |
| --- | --- | --- |
| `SITE.website` | `src/config.ts` | **复用** `https://www.posase.im/`，canonical/规范URL单一来源 |
| `PUBLIC_GOOGLE_SITE_VERIFICATION` | 原构建环境 | **复用**；当前可选的公开验证值 |
| `PORTFOLIO_CONTROL` | Pages + Sync Worker | 同环境CONTROL KV binding；Worker仅代码层只读 |
| `PORTFOLIO_CACHE` | Pages + Sync Worker | CACHE KV binding；Pages只读 |
| `PORTFOLIO_JOBS` | Pages + Sync Worker | JOBS KV binding；不同key限定各自写入职责 |
| `GITHUB_TOKEN` | 仅Sync Worker secret | 最小只读PAT；不设PUBLIC前缀 |
| `GITHUB_OWNER` / `GITHUB_OWNER_TYPE` | Sync Worker变量 | `jesongit` / `user` |
| `GITHUB_API_VERSION` | Sync Worker变量 | `2026-03-10`，端点契约验证后锁定 |
| `SYNC_ENABLED` | Sync Worker变量 | 预览false、生产上线最后启用true；false仍记录停用状态 |
| `CONTENT_SYNC_MINUTES` / `DISCOVERY_SYNC_MINUTES` | Sync Worker变量 | 60 / 360 |
| `PUBLIC_CHECK_MINUTES` / `PUBLIC_VALIDITY_MINUTES` | 两部署共享常量/配置 | 10 / 30；同源配置防止两端语义漂移 |
| `RELEASE_STALE_MAX_HOURS` | 两部署共享常量 | 24 |
| `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` | Pages变量 | 实际Access team host与application audience |
| `ADMIN_EMAILS` / `ADMIN_ALLOWED_HOSTS` | Pages变量 | 明确白名单；生产和预览独立 |
| `CSRF_SECRET` | Pages secret | 强随机签名密钥；只用于管理会话CSRF |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` | 部署环境/本地Wrangler登录 | 不放Worker业务运行环境；最小部署权限 |
| `NODE_VERSION` / `packageManager` | Pages构建设置、package.json、CI | 阶段1锁定兼容的受支持Node版本及pnpm10.11.1，避免latest |
| `SITE_BUILD_TIME` | Astro构建注入常量及类型声明 | 构建时一次生成；静态博客与SSR首页共享文章发布时点，不是运行时secret |

新增 `.env.example` 只含非秘密构建变量；`.dev.vars.example` 与 `workers/portfolio-sync/.dev.vars.example` 给本地运行示例；`.gitignore` 增加 `.dev.vars*`（例外允许example）、`.wrangler/`、测试输出。不能把真实secret填入文档或提交。

### 13.2 Pages配置骨架

新增根 `wrangler.jsonc`，实际项目名和namespace ID从阶段1导出后填写；下面不是已经存在的生产配置：

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "<现有Pages项目名>",
  "pages_build_output_dir": "./dist",
  "compatibility_date": "2026-09-08",
  "compatibility_flags": ["nodejs_compat"],
  "kv_namespaces": [
    { "binding": "PORTFOLIO_CONTROL", "id": "<生产CONTROL>" },
    { "binding": "PORTFOLIO_CACHE", "id": "<生产CACHE>" },
    { "binding": "PORTFOLIO_JOBS", "id": "<生产JOBS>" }
  ],
  "vars": {
    "ACCESS_TEAM_DOMAIN": "<team>.cloudflareaccess.com",
    "ACCESS_AUD": "<真实audience>",
    "ADMIN_ALLOWED_HOSTS": "www.posase.im",
    "ADMIN_EMAILS": "<管理员邮箱>"
  },
  "env": {
    "preview": {
      "kv_namespaces": [
        { "binding": "PORTFOLIO_CONTROL", "id": "<预览CONTROL>" },
        { "binding": "PORTFOLIO_CACHE", "id": "<预览CACHE>" },
        { "binding": "PORTFOLIO_JOBS", "id": "<预览JOBS>" }
      ],
      "vars": {
        "ACCESS_TEAM_DOMAIN": "<team>.cloudflareaccess.com",
        "ACCESS_AUD": "<预览audience>",
        "ADMIN_ALLOWED_HOSTS": "<明确的测试域名>",
        "ADMIN_EMAILS": "<测试管理员邮箱>"
      }
    }
  }
}
```

`astro.config.ts`保留现有markdown、tailwind、sitemap设置，明确 `output:'static'`，加入12.x `cloudflare()` adapter；binding通过该版本的 `Astro.locals.runtime.env`访问，并生成对应 `App.Locals` 类型。不要照搬新版 `cloudflare:workers` 或v13入口约定。

使用adapter生成的 `dist/_worker.js` 和 `_routes.json`；自动检查只把动态路由交给Functions，文章HTML、Pagefind、OG和静态资源走静态服务。对根首页、无尾斜线管理路由和SSR404做真实请求验证；若生成规则不满足要求，用构建后脚本按显式清单调整并测试，不能凭猜测提交规则。[Pages路由机制](https://developers.cloudflare.com/pages/functions/routing/)

Pages配置纳入Wrangler后按文件作为配置来源，先导出并比对控制台设置，防止新文件意外覆盖现有绑定或变量。[Pages Wrangler配置](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)

### 13.3 独立同步 Worker配置骨架

新增 `workers/portfolio-sync/wrangler.jsonc`：

```jsonc
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "portfolio-sync",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-08",
  "workers_dev": false,
  "preview_urls": false,
  "triggers": { "crons": ["* * * * *"] },
  "kv_namespaces": [
    { "binding": "PORTFOLIO_CONTROL", "id": "<同Pages生产CONTROL>" },
    { "binding": "PORTFOLIO_CACHE", "id": "<同Pages生产CACHE>" },
    { "binding": "PORTFOLIO_JOBS", "id": "<同Pages生产JOBS>" }
  ],
  "vars": {
    "GITHUB_OWNER": "jesongit",
    "GITHUB_OWNER_TYPE": "user",
    "GITHUB_API_VERSION": "2026-03-10",
    "SYNC_ENABLED": "false"
  }
}
```

生产启用前把SYNC_ENABLED改true；预览Worker使用单独 `env.preview`完整重复绑定、变量及触发器配置，默认没有生产Cron。不得假设Workers环境的KV或vars自动继承。Cloudflare账户套餐的CPU、子请求、KV读写/列表额度需按50个公开作品和真实访问量测算，超过预算时减小批次，不承诺完全免费。[Workers限制](https://developers.cloudflare.com/workers/platform/limits/) [KV写入限制](https://developers.cloudflare.com/kv/api/write-key-value-pairs/)

### 13.4 计划新增脚本及执行方式

统一从仓库根目录使用pnpm；新增脚本名称需与下列执行步骤一致：

```text
pnpm install --frozen-lockfile
pnpm run lint
pnpm run format:check
pnpm run test
pnpm run test:worker
pnpm run build
pnpm run check:artifact
pnpm run preview:cloudflare
pnpm run test:e2e
pnpm run deploy:sync:preview
pnpm run deploy:site:preview
```

- `build`：Astro check → Astro build（保留Content Layer快照）→ Pagefind → Node复制索引到public；执行环境不需要GitHub token或生产KV。
- `preview:cloudflare`：用锁定Wrangler执行 `pages dev dist`并绑定隔离本地KV；`astro preview`不能独自作为Functions验收证据。
- `test:worker`：Vitest + Workers运行时测试；调度函数直接注入scheduled事件和假GitHub响应，避免真实等待Cron。
- `check:artifact`：检查文章URL、草稿排除、OG图片、索引、SSR路由manifest、客户端bundle无secret/原生Node渲染依赖。
- `deploy:sync:*`：Wrangler从 `workers/portfolio-sync/wrangler.jsonc`部署指定环境；`deploy:site:*`部署Pages构建产物。阶段1若确认现有Pages Git集成，则生产站点仍复用Git集成，不另开同一项目的重复自动部署通道。

Dockerfile原Nginx镜像仅能预览静态文章；修改为明确的静态检查用途并在README说明完整预览使用Wrangler，不假装Nginx能运行新增API。需要容器化完整开发时另给Wrangler开发命令，不引入新生产容器服务。

## 14. 迁移、发布与回滚

### 14.1 现有部署核验与迁移

阶段1记录实际Cloudflare项目类型、项目名、生产分支、构建命令、Node版本、输出目录、域名、预览策略、当前环境变量及原部署ID。只导出变量名称/非敏感值，secret只记录存在性。

推荐继续已有Pages项目。**如果控制台证实当前实际是Workers Static Assets**，不迁到Pages来迎合本计划：保留Astro5按路由SSR的代码决策，把12.x adapter产物的Pages `env.ASSETS`式fetch入口用薄Worker包装接入原Workers部署，并将静态目录指向排除 `_worker.js` 的 `dist`产物；用 `run_worker_first`覆盖动态/管理路径并验证默认HTML资源不会绕过JWT。仍保留独立Cron Worker。该受证据触发的部署映射必须在阶段1做可运行验证并写回运行手册，不同时维护两套生产部署。若12.x产物在现有Workers入口不可用，则本阶段完成明确迁移验证后再推进，而不是把静态服务当SSR已完成。

这不是把两种架构交给用户选择；默认Pages推荐保持不变，只有实际控制台事实才能触发部署映射调整。

### 14.2 数据初始化与上线顺序

1. 固定现有博客构建基线和已发布URL清单；统一工具链并保存可回滚部署ID。
2. 建立预览三套KV、Access预览应用和只读GitHub凭据，部署停止自动同步的Worker及预览站点。
3. 使用测试fixtures验完隔离后，首次全量发现真实公开仓库；所有设置缺失即隐藏，不能从旧Topic或配置推导展示选择。
4. 在预览人工选择少量基础/增强项目，验证内容、Release、下架和搜索；导出明确的展示设置供生产初始化，导入后仍需检查来源公开性。
5. 建立生产KV和Access策略，配置域名保护、secrets与运行变量，部署Sync Worker但保持关闭。
6. 部署包含防护的生产站点；先验证所有管理别名均受保护，再开启Cron并进行首次同步。没有有效缓存时首页保留博客，作品区显示暂无可展示作品/同步中。
7. 管理员按确定清单显式展示和精选，确认两个地区可见性，再完成导航与首页验收；不从测试缓存复制来源内容进生产。
8. 保留最近可用代码部署和CONTROL加密导出；记录版本、KV namespace ID、首次同步runId和上线检查结果。

### 14.3 回滚

- **内容同步故障**：先停SYNC_ENABLED或移除Cron，保留CONTROL；缓存未失去公开资格的作品可按有效期策略运行。修复后重新核验，不通过旧缓存续期公开状态。
- **新作品代码故障**：回滚到上一可用站点/Worker部署；若需要恢复纯博客，原首页及静态文章部署可整体恢复，作品新路由暂时不可用。由于尚无旧作品系统，不伪造旧路由兼容。
- **数据格式变更**：key统一v1前缀，未来破坏性变化用v2namespace/key并停同步→离线转换→验证→切换。禁止原地改Schema导致旧代码误读或让空设置默认发布。
- **恢复设置备份**：先对比导出后所有人工隐藏审计及来源incident；恢复的是明确确认的展示设置，不是用备份覆盖当前撤下状态。无法确认时全部保持隐藏再人工恢复。
- **内容LKG回退**：只能替换内容引用；实时CONTROL、最新资格和incident继续生效。不能回滚墓碑让删除/转私有仓库复活。
- **紧急保密撤下**：先边缘阻断相应作品动态入口，再修复KV状态；确认不同地区的列表、详情、API与搜索均不输出后解除阻断。

## 15. 文件变更总表

本节列出的均是后续开发要新增/修改的文件；本次实际变更只有本文档。

| 文件/目录 | 动作 | 职责 |
| --- | --- | --- |
| `package.json`、`pnpm-lock.yaml`、`.github/workflows/ci.yml` | 修改 | 单一工具链、兼容adapter/校验/运行时测试依赖、脚本、完整CI |
| `package-lock.json` | 删除 | 阶段1基线完成后去除双锁文件 |
| `astro.config.ts`、`src/env.d.ts`、`tsconfig.json`、`eslint.config.js` | 修改 | 静态默认/局部SSR、bindings类型、Worker边界、生成目录排除 |
| `wrangler.jsonc`、`workers/portfolio-sync/wrangler.jsonc` | 新增 | 站点与独立定时Worker配置 |
| `.env.example`、`.dev.vars.example`、`workers/portfolio-sync/.dev.vars.example`、`.gitignore` | 新增/修改 | 非敏感模板与secret/产物忽略 |
| `src/lib/portfolio/types.ts`、`schema/v1.json`、`validate.ts`、`normalize.ts`、`protocol.ts` | 新增 | 单一协议、类型、语义约束和覆盖规则 |
| `src/lib/portfolio/store.ts`、`publication.ts`、`slug.ts`、`search.ts`、`markdown.ts`、`releases.ts` | 新增 | 分离存储接口、门禁、稳定ID、搜索、安全渲染和下载识别 |
| `src/lib/portfolio/config.ts` | 新增 | 两部署共享容量、公开资格与缓存参数 |
| `workers/portfolio-sync/src/index.ts`、`scheduler.ts`、`github.ts`、`sync-repo.ts`、`inventory.ts`、`observations.ts`、`gc.ts`、`env.d.ts` | 新增 | scheduled入口、预算/游标、API请求、同步状态、不可变观察和清理 |
| `src/lib/auth/access.ts`、`csrf.ts`、`src/middleware.ts` | 新增 | 管理页/接口JWT、Origin、CSRF和host验证 |
| `src/pages/admin/index.astro`、`src/scripts/admin.ts`、`src/layouts/AdminLayout.astro` | 新增 | 简单管理UI；可复用主题但避免管理状态被公共页面切换持久化 |
| `src/pages/api/admin/repos/index.ts`、`repos/[repoId]/index.ts`、`repos/[repoId]/settings.ts`、`reorder.ts` | 新增 | 候选读取、设置和排序API |
| `src/pages/api/admin/sync/index.ts`、`sync/[jobId].ts`、`session.ts` | 新增 | 排队、查询和CSRF会话 |
| `src/pages/api/portfolio/spec.json.ts`、`schema/v1.json.ts`、`prompt.txt.ts`、`src/pages/portfolio-guide.astro` | 新增 | 公开规范、Schema、可复制提示词和指南 |
| `src/pages/projects/index.astro`、`[slug].astro` | 新增 | 动态作品列表与详情 |
| `src/layouts/ProjectDetails.astro`、`src/components/portfolio/ProjectCard.astro`、`ProjectGrid.astro`、`ProjectDownloads.astro`、`ProjectSearch.astro` | 新增 | 通用作品展示组件 |
| `src/pages/api/projects/index.ts`、`search.ts`、`src/pages/sitemap-projects.xml.ts` | 新增 | 公开投影、动态搜索和sitemap |
| `src/pages/index.astro`、`src/components/Header.astro`、`src/styles/global.css` | 修改 | 首页作品优先、导航和作品专用宽容器 |
| `src/layouts/Layout.astro`、`PostDetails.astro`、`src/pages/search.astro`、`robots.txt.ts` | 修改 | SEO参数、文章JSON-LD、双来源搜索和sitemap声明 |
| `src/content.config.ts`、`src/utils/postFilter.ts`、`src/pages/posts/[...slug]/index.astro`、`index.png.ts`、`src/pages/archives/index.astro` | 修改 | 草稿目录和定时发布过滤一致；保留文章内容和URL |
| `scripts/copy-pagefind.mjs`、`scripts/check-artifact.mjs`、`scripts/check-routes.mjs` | 新增 | 跨平台生成物、静态/动态路由与敏感信息检查 |
| `vitest.config.ts`、`vitest.worker.config.ts`、`playwright.config.ts`、`tests/portfolio/**`、`tests/worker/**`、`tests/e2e/**`、`tests/fixtures/portfolio/**` | 新增 | 契约、状态机、Workers和浏览器验收 |
| `docs/portfolio/protocol-v1.md`、`docs/portfolio/deployment.md`、`docs/portfolio/runbook.md` | 新增 | 实现完成后的协议解释、实际部署记录和故障操作手册 |
| `README.md`、`Dockerfile`、`docker-compose.yml` | 修改 | 真实开发/预览/部署命令，说明纯静态容器边界 |

无需新增React/Vue管理框架；当前已有Astro和原生浏览器脚本足够。纯逻辑共用模块不得依赖Astro运行时、DOM或Node原生图片模块，方便Pages/Sync Worker共享测试。

## 16. 八个开发阶段

阶段依赖：**1 → 2 → 3 → 4 → 5 → 6 → 7 → 8**。安全/状态机测试随各阶段编写，不到最后才补；阶段7负责跨模块故障与真实边缘联调。每阶段完成后提交可单独审查的变更，不把未通过验收的阶段标成完成。

### 阶段 1：部署核验、构建基线与最小按需渲染验证

**目标**：证明所选渲染方案与现有Cloudflare部署兼容，保留文章静态输出。

**任务**：

1. 记录真实Cloudflare配置和最近可回滚部署，生成现有已发布URL/文章/OG/Pagefind清单。
2. 统一pnpm10.11.1与受支持Node版本，先用现有pnpm锁复现构建，再锁定需要的兼容补丁；移除npm锁、修正CI/Docker/README。
3. 添加精确12.x adapter、Wrangler和隔离预览配置；保留output static，用一个临时隔离路由验证SSR KV读取，验完删除探针。
4. 改跨平台Pagefind复制，统一草稿目录与发布时间过滤，检查构建时Resvg/Sharp没有进入运行时请求依赖。
5. 验证SSR首页可复用现有Content Layer快照；注入统一SITE_BUILD_TIME，确保首页摘要与实际静态文章输出一致。

**文件**：package/锁文件、astro.config、Wrangler配置、CI、content/postFilter及相关路径生成文件、scripts、env类型、部署记录。

**依赖**：无；需要已有Cloudflare项目读取权限来核验真实部署，实际账号值不能臆造。

**验收与测试**：干净安装后lint、format、astro check/build通过；现有文章URL保留，草稿/未来文章无输出；Pagefind至少命中一篇中文文章；OG PNG有效；Wrangler真实运行下静态文章和SSR探针分别正确响应；无生产KV读写。形成部署/版本/产物基线。

### 阶段 2：协议、数据边界与公开规范入口

**目标**：先固定项目内容与发布设置的边界，使基础模式无需配置即可工作。

**任务**：

1. 实现v1 JSON Schema、AJV校验、语义约束、normalize覆盖及basic/enhanced/LKG状态规则。
2. 定义DisplaySettings、SourceObservation、Release、PublicProject及只读/可写存储接口；固定gh-ID slug和默认隐藏。
3. 提供spec/schema/prompt静态API、指南页及合法/非法fixtures。
4. 建立安全Markdown管线、相对链接重写、素材约束和字段来源信息。

**文件**：`src/lib/portfolio/{schema,types,validate,normalize,protocol,slug,markdown,store,config}`、公开规范路由、指南、`docs/portfolio/protocol-v1.md`、协议测试。

**依赖**：阶段1的构建和兼容运行环境。

**验收与测试**：无文件仓库输出完整基础投影；`{"schemaVersion":1}`有效；featured/visible/order/version/未知字段一律失败；新配置省略/空数组/null覆盖符合规则；错误配置保留LKG，删除配置回basic；恶意HTML/脚本/外部ref/路径穿越被拒；公开规范无身份要求且示例与Schema一致。

### 阶段 3：GitHub同步、Releases、KV缓存与下架状态

**目标**：完成Worker+Cron+KV的真实同步链，不依赖UI、不影响管理设置。

**任务**：

1. 实现候选枚举、分页、ID去重、资源条件请求、固定commit读取和重命名恢复。
2. 实现README/增强内容同步、独立Release latest和附件分页及平台识别。
3. 实现每分钟调度、到期任务、单tick预算、检查点、重试与手动任务消费。
4. 实现不可变payload/观察、撤下incident、资格有效期、配置LKG和存储GC。
5. 输出结构化运行日志与管理可读状态，所有秘密脱敏；测量真实候选量及预算。

**文件**：Worker全部同步模块、portfolio store/publication/releases、运行配置、Worker测试和fixtures。

**依赖**：阶段2协议/类型；隔离KV及只读GitHub token。

**验收与测试**：至少5个fixtures覆盖基础、增强、多平台Release、无Release、无README；一次真实只读同步能完成分页；再次同步命中304；不读取私有内容；401/429/5xx不清空候选或续期资格；配置损坏保留增强内容而Release仍可更新；取消展示的设置逐字节不被任何同步改写；旧任务晚完成不能覆盖新观察/墓碑；中途退出可续跑。

### 阶段 4：Access鉴权、管理API与简单管理页

**目标**：让管理员集中控制展示、精选、顺序并操作同步，写入路径完整受保护。

**任务**：

1. 配置正式/预览Access应用，实现JWT、JWKS轮换、issuer/aud/邮箱/host检查。
2. 实现Origin/JSON/CSRF、安全响应头和错误结构，所有管理路径在SSR前保护。
3. 实现候选分页、设置保存、重排、revision冲突提示、审计、恢复incident确认。
4. 实现管理UI、模式与错误状态、复制提示词、手动任务202排队与轮询。

**文件**：auth、middleware、admin layout/page/script、所有admin API、Access部署清单、auth/API测试。

**依赖**：阶段3可读候选和任务消费者；预览Access与测试身份。

**验收与测试**：未登录、伪造身份header、错误aud/issuer、过期JWT、越权邮箱、跨站/无Origin、无CSRF、未知字段全部拒绝；直接访问pages.dev/别名不能绕过；GET无写入；保存后只改变指定设置；已隐藏仍可管理但公开不返回；同步按钮显示queued→running→成功/部分失败；重排部分失败不会显示全部成功。

### 阶段 5：作品页面、下载模块与首页改造

**目标**：上线可读、无JS也有核心内容的通用作品页面，保留博客体验。

**任务**：

1. 实现统一公开投影和门禁，所有页面仅使用PublicProject。
2. 构建列表、卡片、详情、截图与下载分组，覆盖basic/enhanced及空数据状态。
3. 首页作品优先，保留文章摘要、RSS、社交入口；Header新增作品导航。
4. 添加作品专用宽容器、响应式和键盘操作；回归主题、ClientRouter和返回行为。

**文件**：projects路由、ProjectDetails布局、portfolio组件、首页/Header/styles、public API；复用原Content Layer和博客卡片。

**依赖**：阶段3可靠公开数据、阶段4人工选择控制。

**验收与测试**：关闭JS仍有作品标题、正文和真实链接；基础仓库无需任何改动即可被精选；无Release时无版本/下载按钮；有多平台附件时分组正确且未知附件不误判；配置错误仍可显示LKG，私有/撤下作品不出现在任何卡片或详情；手机/桌面、深浅色、键盘、前进后退正常；旧文章URL和功能保持。

### 阶段 6：SEO、双来源搜索与缓存规则

**目标**：动态更新不破坏现有搜索与SEO，不让旧索引复活已下架作品。

**任务**：

1. 修正Layout结构化数据接口、日期缺失、canonical及OG默认规则，更新PostDetails调用。
2. 保留静态博客sitemap和RSS，增加动态作品sitemap、robots声明与管理排除。
3. 实现作品查询API、搜索结果区与Pagefind协调，处理中文、空值、取消请求和网络失败。
4. 为各类响应设置正确缓存、状态码与noindex，检查Cloudflare Cache Rules不覆盖这些决定。

**文件**：Layout/PostDetails、search页面/组件/search.ts、sitemap-projects、robots、astro sitemap配置、SEO和搜索测试。

**依赖**：阶段5可访问作品页面和统一门禁。

**验收与测试**：文章搜索继续命中；新同步项目无需build可搜索；撤下项目不在新响应中；JSON-LD可解析且无undefined/虚构版本；canonical不受Host/配置注入；动态sitemap纳入/移除符合门禁；404与503正确区分；静态博客索引无admin或动态作品副本。

### 阶段 7：故障、并发、安全与真实Cloudflare联调

**目标**：用可复现证据验证关键失败场景和KV实际边界。

**任务**：

1. 执行第17节全套关键矩阵；注入旧值、负缓存、半传播payload、重复Cron、旧任务延迟完成、分页中断。
2. 在预览真实模拟重命名、旧名称复用、转私有、删除、重新公开、取消展示、坏配置和Release删除。
3. 从两个地区观测可见性传播时间，记录结果与目标差距；审查所有公开入口是否使用门禁。
4. 运行安全HTML、JWT、CSRF、日志脱敏与客户端bundle检查；测量50个展示作品下的请求数、KV读写、执行时间和成本预算。
5. 演练只回滚内容引用、恢复代码、暂停Cron与保留隐藏设置的恢复流程。

**文件**：Worker/API/e2e测试、fixtures、check-artifact、CI与runbook；发现缺陷时修正对应实现。

**依赖**：阶段1–6全部验收。

**验收与测试**：安全和发布不变量全部通过；两地区实测报告、故障报告与回滚记录完整；无未解释的旧内容回流；超过预算能拆批续跑；CI从干净安装可重现；明确保留KV最终一致性限制，不伪造强一致测试结论。

### 阶段 8：生产初始化、上线与交付

**目标**：按可回滚顺序发布，并确认真实站点完整可用。

**任务**：

1. 按第14节建立生产KV/Access/secrets，记录原部署、最终配置和回滚入口。
2. 先发布受保护站点和停止自动同步的Worker，验证管理路由及所有别名，再启用Cron和首次同步。
3. 人工选择真实项目展示、精选、排序；抽检至少一个纯基础、一个增强、一个无Release和一个多平台附件项目。
4. 执行第18节检查清单，实际触发一次手动同步、一次定时同步和一次隐藏/恢复流程。
5. 更新README、部署记录与操作手册，交付如何轮换PAT、查看日志、修复配置、紧急撤下与回滚的具体命令。

**文件**：生产Wrangler配置与部署环境、README、docs/portfolio/deployment.md、runbook.md、最终验收记录。

**依赖**：阶段7通过，生产Cloudflare项目权限及最终展示清单由管理页实际保存。

**验收与测试**：正式域名的静态博客、Pagefind、RSS、OG、作品首屏和详情正常；Access保护完整；真正Cron日志与手动job结果成功；生产与预览完全隔离；无secret入库；回滚方案实际演练过，才标记本阶段完成。

## 17. 关键测试矩阵与实施门槛

| 类别 | 最低覆盖场景 | 必须断言 |
| --- | --- | --- |
| 数据所有权 | 重复同步、配置含visible/featured/order、隐藏时同步新Release | 同步不写CONTROL；AI配置不能改变发布状态 |
| 配置生命周期 | 无配置→合法→非法→修复→删除；首次就是非法 | mode/LKG/默认值切换正确；删除字段不从旧配置复活 |
| 资源独立性 | README304但Release新增；坏配置但Release更新；同tag新增/删除附件 | 缓存按资源变化；正式版本与附件来自GitHub |
| GitHub分页 | 101+候选、重复ID、第二页失败、分页间重命名 | 完整去重，不误批量下架；失败清单不替换完整inventory |
| 身份 | 重命名、旧名新ID、转移出owner、GraphQL错误 | 稳定URL与设置仍绑定原ID；不同ID不继承展示 |
| 发布门禁 | hidden/private/404/out_of_scope/过期资格/未确认恢复 | 首页/详情/公开API/搜索/sitemap全入口一致拒绝 |
| 私有与故障区分 | 有权限token返回private、无权限404、401、限流403、5xx | private/不可访问撤下；凭据/网络错误不虚报删除且不续期资格 |
| Releases | 无Release、仅预发布、无附件、未知平台、多架构、删除Release、旧版不同发布日期 | 无虚假版本/链接；正确published_at；source包不冒充安装包 |
| KV一致性 | 设置旧读、obs先可见payload后可见、事件先/后可见、晚完成旧run | 不出现混合半成品；不覆盖新墓碑；合理503；明确最终一致限制 |
| 人工编辑 | 同页双击、两个旧revision、重排部分失败 | 409或明确最后写入语义；无静默“全成功”；审计可追溯 |
| 鉴权 | 缺JWT、假邮箱header、错aud/issuer/算法、过期、未知kid、JWKS故障、别名访问 | 页面和API都失败关闭，静态资源不能绕过管理鉴权 |
| CSRF与输入 | 跨Origin、缺Origin、缺token、无效签名、非JSON、超限body、任意repoURL | 拒绝写入，无上游任意URL请求 |
| 内容安全 | script、svg事件、javascript链接、iframe、raw HTML、JSON-LD闭合、路径穿越 | 无可执行注入，safe HTML与URL白名单生效 |
| 搜索SEO | 中文、q恢复、JS关闭、Host注入、下架后新查询 | 原Pagefind可用，SSR有正文，canonical正确，无旧作品索引回流 |
| 博客回归 | 所有原发布URL、草稿、未来文章、标签、分页、归档、RSS、文章OG | 原能力复用且无新增泄漏；过滤一致 |
| 恢复 | 上一内容回退、旧CONTROL备份、停Cron、纯博客部署回滚 | 当前人工隐藏/incident优先，不因回滚重新上架 |

单元测试侧重normalize、publication、slug、平台分类等业务分支；Worker集成测试验证真实KV API形状、scheduled流程和资源故障；Playwright验证访问、状态变化和交互。真实Cloudflare预览测试单独标注，不能用本地KV模拟器证明跨地区一致性。

新增CI顺序：干净安装 → lint/format → 协议/纯逻辑单测 → Workers集成测试 → Astro check/build → artifact检查 → 隔离环境e2e。原CI的3分钟timeout需要依据测量提高或拆job，Node矩阵与正式构建版本一致。CI使用mock GitHub和测试JWT，不使用生产PAT/KV；真实预览检查作为受控发布验收。

## 18. 最终联调与上线检查清单

### 18.1 代码与部署

- [ ] 已导出并核实实际Cloudflare部署方式，生产只有一条明确部署通道。
- [ ] Astro/adapter/Node/pnpm/Wrangler已锁定，干净安装与CI全部通过。
- [ ] `output:'static'`与SSR路由清单一致，静态文章/Pagefind/OG不误走运行时渲染。
- [ ] 构建不需要生产KV或GitHub token；Resvg/Sharp未进入作品运行时路径。
- [ ] Pages/Worker生产与预览KV、Access audience、secrets隔离。
- [ ] Cron真正触发并留下runId，手动任务真正被消费，停止/恢复Cron有效。
- [ ] 配额与成本按实际请求/读取量测量，没有以“Cloudflare免费”代替预算。

### 18.2 发布与数据正确性

- [ ] 任意普通公开仓库无需Topic/配置/Actions即可入候选并被人工精选。
- [ ] 新仓库默认隐藏；增强配置不能写展示、精选、排序、slug或版本。
- [ ] 多次/重复/失败同步均未覆盖人工选择与order。
- [ ] 重命名保留URL和精选；同名新ID没有继承旧展示状态。
- [ ] 删除、转私有、出owner、人工隐藏均从首页、详情、API、搜索、sitemap撤下。
- [ ] 重新公开需要确认最新incident，旧备份/旧任务不能偷偷恢复展示。
- [ ] 配置错误保留有效增强内容；配置删除回基础；公开资格到期不会无限使用旧缓存。
- [ ] 无Release无假版本或下载；Release删除、附件变动、未知平台都按规则处理。
- [ ] token失效/限流/分页失败与仓库删除有明确区别；重试不形成请求风暴。

### 18.3 安全与SEO体验

- [ ] `/admin`、`/admin/*`、`/api/admin`、`/api/admin/*`及所有别名都验证JWT。
- [ ] JWT issuer/aud/算法/期限、Origin/CSRF、body白名单与大小限制真实生效。
- [ ] 客户端bundle、页面源代码、公开API、日志、仓库中没有secret或内部隐藏资料。
- [ ] README/增强Markdown/Release Notes经过相同安全清洗；外链和相对图片解析正确。
- [ ] 新页面无JS也可读，移动端/键盘/深浅色/前进后退可用。
- [ ] 原文章地址、RSS、Pagefind、标签、归档与OG全部回归通过。
- [ ] title/description/canonical/OG/JSON-LD与作品真实资料一致，无undefined或虚构事实。
- [ ] 静态/动态sitemap分工正确，robots声明齐全，错误状态码与noindex正确。
- [ ] Cache Rules不缓存管理和作品动态响应；已从两个地区记录隐藏传播结果。

### 18.4 运维交付

- [ ] 管理页能看到最后成功同步、公开验证、配置错误、排队任务及retryAt。
- [ ] 保存生产代码版本、部署ID、KV映射、人工设置加密备份及审计保留策略。
- [ ] 演练过暂停Cron、PAT轮换、内容回退、代码回滚和边缘紧急撤下。
- [ ] 运行手册明确KV最终一致性与正常撤下目标，没有承诺无法实现的全球即时撤回。
- [ ] 最终展示项目清单由管理页实际保存，所有八个阶段有验收证据。

---

本文档以代码基线与上述官方能力说明为依据。后续开发先完成阶段1部署事实与版本验证，再依次推进；任何实现都必须保持“管理设置独立、GitHub事实权威、配置错误可回退、失去公开资格必须撤下”四项不变量。
