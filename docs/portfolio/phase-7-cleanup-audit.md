# 阶段七：旧作品同步实现清理审计

> 本报告只记录清理边界和证据，不删除代码、绑定、KV 数据或 Cloudflare 账号资源。
> 审计基于 `b887c21`，审计分支为 `codex/phase7-cleanup-audit`。

## 结论

当前 HEAD 已包含作品系统的实现，但没有发现一个已合并的替代
`portfolio-sync` Worker、批量设置 API 或新的任务执行通道。当前
`workers/portfolio-sync` 是唯一可见的定时采集实现，不能仅因目录名或“旧实现”
描述而直接删除。

本次只提交本报告。审计开始时工作树中唯一已有改动是未跟踪的 `.tel.json`；
未读取、未修改、未加入提交，也没有读取或记录其中的内容。

## 1. 可删除候选（必须满足前置条件）

| 范围 | 当前证据 | 删除前置条件 |
| --- | --- | --- |
| `workers/portfolio-sync/src/index.ts`、`scheduler.ts`、`env.d.ts`、`tsconfig.json`、`wrangler.jsonc`、`.dev.vars.example` | 当前 Cron 入口、预算/游标、JOBS 消费和 CACHE 写入均由此目录提供；`scheduler.ts` 被 `tests/lib/portfolio-worker.test.ts` 直接导入 | 新 scheduled consumer 已部署并完成切换；旧 Cron 已停止；新实现保留资格检查、分页续跑、不可变观察、撤下事件和 payload 写入；测试与文档已迁移。不能删除 Cloudflare 侧 Worker 或 namespace。 |
| `workers/portfolio-sync/src/inventory.ts` | 负责完整分页、数字 ID 去重和分页失败时不提交 inventory；由当前 `scheduler.ts` 调用 | 只有在替代采集器提供等价的分页/续跑/不误删语义后才能删除或迁移；不应把它当作无用旧文件。 |
| `src/pages/api/admin/reorder.ts` | 仓库内没有前端或其他代码调用 `/api/admin/reorder`，只有计划文档和该路由自身引用；它逐项调用 `ControlStore.putSettings` | 确认没有外部客户端依赖，并先完成新排序 API 的上线、文档迁移和回归测试。删除该路由不等于可以删除设置写入能力。 |
| `ControlStore.putJobRequest`、`deleteJobRequest`、`getJobRequest`（`src/lib/portfolio/store.ts`） | 只有定义和注释引用；现有管理 API/Worker 实际使用的是独立的 `JobsStore` | 确认没有外部导入后可在后续清理中移除。这三项尤其不应恢复使用，因为它们会把 JOBS 请求方法挂在 CONTROL 存储对象上。 |
| `src/lib/portfolio/demo.ts` | 当前仓库没有发现导入方；正式公开读取走 KV + 发布门禁 | 确认没有外部脚本或部署工具导入后可删除；删除前不应把 demo 数据当成生产迁移源。 |
| JOBS 专属代码：`JobsStore`、`SyncJob`/`SyncJobResult`、`KEYS.jobRequest*`/`jobResult*`、`/api/admin/sync` 两个路由、管理页同步轮询、`SYNC` 中任务 TTL/冷却常量 | 当前管理页通过 POST 创建任务，Worker 通过 JOBS 消费并写结果，前端每 5 秒轮询；`tests/lib/portfolio-worker.test.ts` 覆盖 queued/succeeded/expired | 只有在产品明确取消手动同步或有替代触发/状态通道，并完成数据迁移、客户端切换和任务终态回归后才能删除。当前没有替代通道，故本次不删。 |
| JOBS 绑定声明：根 `wrangler.jsonc`、`workers/portfolio-sync/wrangler.jsonc`、`src/env.d.ts`、`workers/portfolio-sync/src/env.d.ts`、`tests/worker/wrangler.test.jsonc` | 当前 Pages、Sync Worker、测试配置均声明 `PORTFOLIO_JOBS`；`src/lib/admin/api.ts` 要求三套绑定齐全 | 先停止所有 JOBS 读写并删除代码引用，再从代码/测试配置中移除绑定。只改仓库配置，不删除 Cloudflare 账号侧 KV namespace；保留回滚和数据保留记录。 |

### 不属于整目录删除范围的 Worker 模块

`workers/portfolio-sync/src/github.ts` 和 `sync-repo.ts` 承载通用 GitHub
采集、条件请求缓存、限流/凭据错误区分、固定 commit 读取、配置校验、README
安全渲染、Release 独立读取、资格判断和 payload 生成。若未来替换 Worker，
应先迁移或抽出这些能力，再删除 Worker 外壳；不能因删除 `index.ts` 或
`scheduler.ts` 顺带删除它们。

## 2. 必须保留的公共能力

以下模块仍是公开数据正确性和安全边界，不应作为“旧同步实现”一并清掉：

- 采集与身份：`github.ts`、`sync-repo.ts`、`inventory.ts` 中的公开资格、数字
  ID、重命名、分页失败、限流和资源独立更新语义。
- 协议与清洗：`src/lib/portfolio/{config,types,validate,normalize,markdown,releases,protocol}.ts`
  以及 `schema/v1.json`。它们负责未知字段拒绝、配置 LKG、Markdown 清洗、
  Release 来源和容量/URL 限制。
- 发布门禁：`src/lib/portfolio/publication.ts` 与 `view.ts`，尤其是
  `evaluatePublication`、`toPublicProject`、`listPublicProjects` 和
  `lookupPublicProject`。首页、列表、详情、公开 API、搜索和 sitemap 都依赖
  这条门禁，不能由旧 Worker 清理替代。
- 稳定身份和查询：`slug.ts`、`search.ts` 及 `/projects`、`/api/projects`、
  `/api/projects/search`、`sitemap-projects.xml` 路由。
- 存储边界：`PortfolioKV`、`jsonPut`、`listAllKeys`、`ControlStore` 的设置/审计
  能力、`PublicCacheStore` 的观察/事件/payload/inventory 读取能力，以及
  `SyncWriteStore` 的内容寻址、HTTP 缓存、运行状态和不可变观察写入能力。
  `gcPayloads` 当前没有调用方，但它对应 48 小时无引用 payload 回收约束；在
  替代 GC 或明确保留策略前应保留，而不是因暂时未调用就删除。
- 管理保护：`src/lib/auth/access.ts`、`csrf.ts`、`src/middleware.ts`、
  `src/lib/admin/api.ts`、管理页和设置 PATCH。逐项设置保存仍是当前管理页的
  实际路径，不能和无调用方的旧 `reorder.ts` 混为一谈。
- 质量门禁：`scripts/check-artifact.mjs`、`scripts/check-routes.mjs`、
  `tests/portfolio/**`、`tests/lib/auth.test.ts`、`tests/lib/admin-settings.test.ts`、
  公开路由 e2e 测试。它们分别保护协议/清洗/发布门禁、鉴权/CSRF、设置冲突、
  公开入口和静态/SSR 路由边界。

## 3. 配置与文档处理

### 保留并在切换后更新

- `wrangler.jsonc` 中的 `PORTFOLIO_CONTROL` 与 `PORTFOLIO_CACHE` 绑定仍被
  Pages 公开读取和门禁使用；不能移除。`PORTFOLIO_JOBS` 只能按第 1 节的
  队列退役顺序处理。
- `README.md`、`docs/portfolio/deployment.md` 和 `runbook.md` 是当前操作入口。
  若 Worker 或 JOBS 退役，应更新部署命令、Cron/任务状态、回滚步骤和 namespace
  说明，不应在替代文档落地前直接删除。
- `docs/portfolio/protocol-v1.md`、`baseline-2026-09-09.md` 和
  `baseline-urls.txt` 是协议/历史基线证据，应保留；基线文件不能用清理动作
  覆盖。

### 需要单独校正的过时叙述

`docs/plans/portfolio_development_plan.md` 的部分段落仍描述“尚未实施”和“本次
只新增文档”，与当前代码状态不一致。它应在阶段完成后标注为历史计划或更新
完成证据，但不能在没有替代架构记录时删除。

当前 `scripts/verify-all.mjs` 也没有执行 `test:worker`；这是验证链缺口，不是
可删除理由。后续应修正验收脚本或在报告中明确其适用范围。

## 4. 后续破坏性清理顺序

1. 记录新 Worker/API 的部署版本、旧 Worker 的停止时间、JOBS 未完成任务处理和
   回滚点；只做账号侧只读核验，不删除 Cloudflare 资源。
2. 先上线替代采集/执行链，验证公开资格、配置校验、Release、payload 传播、
   incident 和发布门禁，再停旧 Cron。
3. 切换管理页和外部客户端，确认设置 PATCH、排序、同步状态和所有公开入口的
   新路径均有测试覆盖。
4. 在日志/KV 读写审计中确认旧 key 前缀和旧 API 不再读写后，才删除仓库内的
   旧路由、任务类型、绑定声明、部署脚本和过时文档引用。
5. Cloudflare Worker、KV namespace、Access 应用和其他账号侧资源不在本次或
   后续代码清理的默认授权范围内；任何资源下线必须由操作者另行确认并执行。

## 5. 已知阻塞与证据边界

- 当前可达历史只有作品系统首次引入（`548042a`）和后续管理修复
  （`b887c21`）；没有可供切换的替代 Worker/API 提交。
- 现有 `tests/worker/smoke.test.ts` 只证明本地 workerd 的 KV API 形状和配置
  约定；`tests/lib/portfolio-worker.test.ts` 的 Worker 逻辑使用 Node 内存 KV
  和假 GitHub 响应。它们不能证明真实 Cloudflare 两地区传播或账号侧绑定。
- 本次没有访问 Cloudflare 账号、没有执行部署、Cron 操作、KV 删除或资源删除；
  生产 namespace 是否仍被其他服务使用，必须由有权限的操作者通过账号侧清单
  另行确认。
- Wrangler 配置包含部署运行所需的非公开运营信息。本报告不复制任何 namespace
  标识、邮箱、token、CSRF secret 或验证码；后续发布前仍应单独完成配置保密性
  审查。

## 6. 本次验证

- `pnpm test`：10 个测试文件、67 个测试通过。
- `pnpm test:worker`：1 个测试文件、2 个测试通过；进程退出时出现 Windows
  workerd 临时目录 `EBUSY` 清理警告，但退出码为 0。
