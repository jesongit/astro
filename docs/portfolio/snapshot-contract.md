# 作品构建快照边界

公开作品页面的输入是仓库内由 GitHub Actions 生成并随 Astro 一起构建的三个 JSON 文件：

- `data/portfolio/settings.json`：人工维护的 `visible`、`featured` 和 `order`；未配置或 `visible` 不是 `true` 的仓库默认隐藏。
- `data/portfolio/sources.json`：同步得到的来源观察，至少提供 `repoId`、`fullName`、`eligibility`、`observedAt` 和 `lastPublicVerifiedAt`。
- `data/portfolio/projects.json`：已经清洗的作品内容；可以用 `repos` 按 repo ID 索引，也可以用 `projects` 数组保存记录。数组记录必须带 `repoId`/`id` 或 `gh-<ID>` slug。

`src/lib/portfolio/snapshot.ts` 是阶段一/二快照容器的唯一适配边界。它支持上述两种容器外形，但不兼容旧 KV key、旧 observation 历史或 GitHub API 响应。公开视图会将静态记录重新交给现有发布门禁：人工隐藏、非公开资格、资格过期、未确认撤下事件和缺少作品内容都不会出现在列表、详情、搜索、公开 API 或动态 sitemap 中。

访客请求只读取构建产物中的模块，不读取 Cloudflare KV、不执行 KV List，也不向 GitHub 发请求。空快照是合法的初始状态；作品数据缺失时列表为空，详情按既有约定返回 404 或资料不可用状态。
