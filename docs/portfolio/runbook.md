# 作品系统运维手册(Runbook)

> 适用范围:作品展示、GitHub Actions、管理页。
> GitHub 仓库中的 settings/sources/projects 是事实文件；公开请求只读取
> 构建时提交的 projects.json。

## 日常命令

```bash
pnpm run build              # check + 构建 + Pagefind + 索引复制
pnpm run typecheck          # Astro + Sync Worker 类型检查
pnpm run lint               # ESLint
pnpm run format:check       # Prettier
pnpm run check:artifact     # 产物安全/结构检查
pnpm run check:routes       # SSR 路由清单检查
pnpm run test               # 纯逻辑/协议/门禁/鉴权
pnpm run test:worker        # Worker 集成测试
pnpm run test:e2e           # 隔离 Wrangler 预览上的浏览器验收
pnpm run verify:all         # 按 CI 顺序执行完整本地验收
pnpm run preview:cloudflare # 本地 Wrangler 预览构建产物
pnpm run deploy:site:preview    # 部署站点预览环境
pnpm run deploy:sync:preview    # 部署同步 Worker 预览环境
pnpm run workflow:dispatch -- --mode build # 手动触发统一作品 workflow
pnpm run portfolio:sync -- full              # 本地模拟全量同步
pnpm run portfolio:sync -- build             # 只从 settings + sources 生成 projects
```

生产部署使用 Git 集成或 `wrangler pages deploy dist`(操作者确认后固化,
不同时维护两条生产通道)。

统一 workflow 的手动模式为 `full`、`repo`、`build`。`full`/`repo` 由 Actions
调用 GitHub API、更新 `sources.json` 与 `projects.json`，内容有变化才提交；
`build` 只读取 GitHub 中的 `settings.json` 与 `sources.json` 重建 `projects.json`。
每小时 schedule 执行 `full`。workflow 没有 push 触发器，数据提交不会自触发循环。

## 常见操作

### 查看同步状态

在 GitHub Actions 页面查看 `Portfolio` workflow 的 run 状态与日志；Admin 的同步
状态接口也直接读取 Actions run。不要把旧 KV 的任务状态当作新的成功依据。

### 手动触发同步

管理页「全量同步」/「同步」会调用 GitHub workflow_dispatch；随后按 run ID
轮询 `queued`、`running`、`succeeded`、`failed` 或 `cancelled`。失败不能显示为成功。

### 轮换 GitHub PAT

1. GitHub 生成仅有本仓库 Contents/Actions 所需权限的细粒度 PAT；
2. 将它更新到 Pages Secret（例如 `GITHUB_TOKEN`），不要写入仓库或前端；
3. 手动运行一次 `build` 或 `full`，确认 Actions 与 Admin 状态恢复；
4. 作废旧 token。

### 修复某仓库的增强配置

1. 管理页该仓库卡片若显示「配置错误」,查看仓库 `.portfolio/portfolio.json`;
2. 按协议文档修正后推送到默认分支;
3. 下一次内容同步(≤1 小时)或手动「同步此仓库」自动恢复 LKG → 新内容。

## 故障处理

### 紧急撤下单个作品

1. 管理页关闭该仓库「展示」(立即使门禁拒绝);
2. 若 Pages 部署尚未完成,在 Cloudflare 边缘临时加规则阻断
   `/projects/gh-<ID>/`(§8.4);
3. 确认两个地区的列表、详情、`/api/projects`、搜索均不再输出后解除边缘阻断。

### 紧急下架全部作品

临时关闭全部作品动态入口(边缘规则阻断 `/projects/*`)，静态文章照常可用。
不要通过清空或回滚 settings.json 之外的旧 KV 数据来处理新快照。

### GitHub token 失效(401)

Actions run 会失败且不应提交新的公开快照。按上文「轮换 GitHub PAT」处理后，
重新运行 `full` 或 `build`。

### GitHub 限流(429/403)

Actions 日志记录失败；不应删除现有数据。检查 PAT 配额与候选规模后重新运行。

### GitHub Actions 状态

同步状态以 GitHub run 的 `status/conclusion` 为准；Admin 只显示标准化状态和
Actions 日志链接。`build` 成功后，Pages Git 集成或 Actions 部署所有者（只能有一个）
负责发布。

### 坏配置 / Release 接口故障

- 坏配置:保留上一份有效增强内容(LKG),修复配置自动恢复;
- Release 接口 5xx/超时:公开侧沿用上一版本最多 24 小时且仍需资格有效,
  超过后隐藏版本与附件,保留 GitHub 链接。

### 回滚

| 场景 | 动作 |
| --- | --- |
| 代码故障 | 回滚到上一可用部署 ID(§14.1 记录);静态博客整体可恢复 |
| 同步故障 | 暂停或重新运行 GitHub Actions；保留最近一次有效 JSON |
| 内容回退 | 回滚 GitHub 数据提交，再运行 `build` |
| 设置恢复 | 通过 Git 历史恢复 settings.json，确认 SHA 后重新触发 `build` |

**红线**:任何回滚都不能让已删除/转私的仓库复活——墓碑(v1:incident)与
人工隐藏设置优先于一切旧备份。

旧 KV namespace、旧 Worker 或旧 Cron 的停用/删除不属于本手册的自动操作；本次
保留它们作为待退役清理项，不执行任何账号侧删除。

## 两地区传播验证(阶段 7,需操作者执行)

从两个地区(如本地 + 一个境外代理)分别请求隐藏前的作品 URL,
记录从保存 `visible=false` 到两地均 404/503 的时间;
目标 ≤ 2 分钟(运维目标,非平台 SLA)。把结果记录到本文档附注。
