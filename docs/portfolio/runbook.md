# 作品系统运维手册(Runbook)

> 适用范围:作品展示、同步 Worker、管理页。
> 四项不变量优先于一切操作:管理设置独立、GitHub 事实权威、
> 配置错误可回退、失去公开资格必须撤下。

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
pnpm run preview:cloudflare # 本地 Wrangler 预览(本地 KV)
pnpm run deploy:site:preview    # 部署站点预览环境
pnpm run deploy:sync:preview    # 部署同步 Worker 预览环境
pnpm run workflow:dispatch -- --mode build # 手动触发统一作品 workflow
```

生产部署使用 Git 集成或 `wrangler pages deploy dist`(操作者确认后固化,
不同时维护两条生产通道)。

统一 workflow 的手动模式为 `full`、`repo`、`build`。`full`/`repo` 先通过
JOBS KV 排队并等待 Sync Worker 的 `succeeded` 结果,随后才构建;`build` 直接构建。
每小时 schedule 只做 `build`,数据生成仍由现有 Worker Cron 负责。workflow 没有
push 触发器,不会因为生成提交循环运行。

## 常见操作

### 查看同步状态

`wrangler tail portfolio-sync` 观察 Cron 运行;或查询 KV:
`v1:run:<runId>`(最近 30 天)。

### 手动触发同步

管理页「全量同步」/「同步此仓库」;冷却:全量 10 分钟、单仓库 60 秒(429 + retryAt)。
任务状态以管理 API 返回的 `queued`、`running`、`succeeded`、`partial`、`failed`、
`expired` 或 `interrupted` 为准；不要绕过管理 API 直接写 KV。

### 轮换 GitHub PAT

1. GitHub 生成新的细粒度只读 PAT;
2. `wrangler secret put GITHUB_TOKEN --config workers/portfolio-sync/wrangler.jsonc`;
3. 观察下一次 Cron:401(credential_error)应消失,公开检查恢复续期;
4. 作废旧 token。

### 修复某仓库的增强配置

1. 管理页该仓库卡片若显示「配置错误」,查看仓库 `.portfolio/portfolio.json`;
2. 按协议文档修正后推送到默认分支;
3. 下一次内容同步(≤1 小时)或手动「同步此仓库」自动恢复 LKG → 新内容。

## 故障处理

### 紧急撤下单个作品

1. 管理页关闭该仓库「展示」(立即使门禁拒绝);
2. 若 KV 传播慢于预期,在 Cloudflare 边缘临时加规则阻断
   `/projects/gh-<ID>/`(§8.4);
3. 确认两个地区的列表、详情、`/api/projects`、搜索均不再输出后解除边缘阻断。

### 紧急下架全部作品

临时关闭全部作品动态入口(边缘规则阻断 `/projects/*` 与首页作品区
由 KV propagation 自然收敛),静态文章照常可用。绝不清空 CONTROL。

### GitHub token 失效(401 credential_error)

同步 Worker 自动停止盲重试;公开内容最多沿用至资格 30 分钟到期。
按上文「轮换 GitHub PAT」处理后自动恢复。

### GitHub 限流(429/403)

Worker 按 Retry-After / X-RateLimit-Reset 暂停至 retryAt,不删除任何数据。
无需人工干预;频繁出现则检查 PAT 配额与候选规模。

### GitHub Actions 状态

v1 同步链路不读取 GitHub Actions，也没有 Actions run 状态展示。同步健康度只看
Worker 的 `v1:run:<runId>` 和手动任务结果。不要通过创建工作流或添加 Actions token
来“补齐”状态；如果产品新增该需求，先定义权限、缓存、失败语义和独立验收矩阵。

### 坏配置 / Release 接口故障

- 坏配置:保留上一份有效增强内容(LKG),修复配置自动恢复;
- Release 接口 5xx/超时:公开侧沿用上一版本最多 24 小时且仍需资格有效,
  超过后隐藏版本与附件,保留 GitHub 链接。

### 回滚

| 场景 | 动作 |
| --- | --- |
| 代码故障 | 回滚到上一可用部署 ID(§14.1 记录);静态博客整体可恢复 |
| 同步故障 | `SYNC_ENABLED=false` 重新部署 Worker(或移除 Cron),保留 CONTROL |
| 内容回退 | 只替换内容引用(指向旧 payload hash);CONTROL/资格/事件不回滚 |
| 设置恢复 | 使用 CONTROL 加密导出;恢复前比对审计记录,无法确认时全部保持隐藏再人工恢复 |

**红线**:任何回滚都不能让已删除/转私的仓库复活——墓碑(v1:incident)与
人工隐藏设置优先于一切旧备份。

旧 KV namespace、旧 Worker 或旧 Cron 的停用/删除不属于本手册的自动操作；本系统
不读取旧格式，任何云端资源清理都必须单独审批并由有权限的操作者执行。

## 两地区传播验证(阶段 7,需操作者执行)

从两个地区(如本地 + 一个境外代理)分别请求隐藏前的作品 URL,
记录从保存 `visible=false` 到两地均 404/503 的时间;
目标 ≤ 2 分钟(运维目标,非平台 SLA)。把结果记录到本文档附注。
