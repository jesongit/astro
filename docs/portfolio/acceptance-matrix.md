# 作品系统验收矩阵

本文档记录当前代码基线的可重复验收入口。它只描述本地代码和隔离测试，
不代表生产 Cloudflare 已完成联调；生产凭据、token、验证码和云端资源均不写入
仓库。当前实现没有兼容旧 KV key、旧 Worker 或旧 Cron 的代码，本次也不删除任何
云端旧资源。

## 验证顺序

在项目根目录执行：

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm run format:check
pnpm run test
pnpm run test:worker
pnpm run build
pnpm run check:artifact
pnpm run check:routes
pnpm run test:e2e
```

`pnpm run verify:all` 是上述顺序的本地快捷入口。`test:e2e` 会在已构建的
`dist/` 上启动隔离的 Wrangler Pages 预览；不使用生产 KV、GitHub token 或 Access
身份。CI 还会显式安装 Chromium 后执行同一套浏览器验收。

## 功能矩阵

| 验收项 | 覆盖位置 | 关键断言 | 当前状态 |
| --- | --- | --- | --- |
| 空配置 / 首次坏配置 | `tests/lib/portfolio-worker.test.ts`、`tests/lib/admin-api.test.ts` | 无 inventory 返回明确空状态；无配置走基础模式；首次非法配置仍有基础 payload | 已覆盖 |
| 配置生命周期 | `tests/portfolio/normalize.test.ts`、`tests/lib/portfolio-worker.test.ts` | valid → invalid 保留 LKG；删除配置回 basic；缺失字段不从旧配置复活 | 已覆盖 |
| 候选分页 | `tests/lib/inventory.test.ts`、`tests/worker/smoke.test.ts` | 101+ 候选、重复 ID、私有仓库过滤、第二页失败保存游标并可续跑、KV cursor 可继续读取 | 已覆盖 |
| 单仓库同步 | `tests/lib/portfolio-worker.test.ts`、`tests/lib/admin-api.test.ts` | 单仓库请求返回 202 queued；Worker 消费后写结果；请求按仓库冷却 | 已覆盖 |
| 冲突与脏保存 | `tests/lib/portfolio-worker.test.ts`、`tests/lib/admin-api.test.ts` | stale revision 返回 409；脏保存只改变提交字段；批量重排明确报告部分失败 | 已覆盖 |
| Release / 附件 | `tests/portfolio/releases.test.ts`、`tests/lib/portfolio-worker.test.ts` | 无 Release、正式版本、附件状态、平台冲突、校验文件、Release 删除和独立更新 | 已覆盖 |
| Actions run 状态 | 无对应源码、API、类型或 fixture | 当前 v1 不读取 GitHub Actions，也不声明 Actions 成功；若产品要求显示 run 状态，需先定义数据来源、权限、缓存和失败语义 | 未实现 / 阻塞项 |
| 安全 | `tests/lib/auth.test.ts`、`tests/portfolio/validate.test.ts`、`tests/portfolio/markdown.test.ts`、`scripts/check-artifact.mjs` | JWT issuer/aud/期限/邮箱、CSRF、未知字段、路径/URL、Markdown 注入、客户端产物敏感值检查 | 已覆盖 |
| 发布门禁 | `tests/portfolio/publication.test.ts`、`tests/lib/portfolio-worker.test.ts` | hidden、private、404/owner 越权、过期资格、未确认 incident 不进入公开投影 | 已覆盖 |
| 博客回归 | `tests/e2e/smoke.spec.ts`、`scripts/check-artifact.mjs` | 已有文章 URL、文章分页、标签、归档、RSS、robots、Pagefind、OG、草稿不泄漏、真实 404 | 已覆盖 |
| 路由 / 产物 | `scripts/check-routes.mjs`、`scripts/check-artifact.mjs` | SSR 路由 include 完整；博客保持静态；管理/作品页不静态化；产物无草稿和敏感值 | 已覆盖 |

## 诚实边界

- `test:worker` 使用 workerd 的真实 KV API 形状，并调用真实 Worker 的
  `scheduled`/`fetch` 入口；完整 GitHub 调度状态机在 Node 测试中注入假上游，
  不把本地模拟器当成跨地区一致性证明。
- `typecheck` 包含 Astro 检查和 `workers/portfolio-sync/tsconfig.json` 的独立
  TypeScript 检查，避免 Worker 被根 `tsconfig` 排除后仍能合并。
- `check:artifact` 与 `check:routes` 必须在本次构建后执行；单独执行没有有效的
  `dist/` 输入。
- 真实 Cloudflare Pages、Access、Cron、KV 最终一致性、两地区传播时间和生产
  回滚仍需由有权限的操作者按 [deployment.md](./deployment.md) 执行并另行记录。
- Actions run 状态是明确的产品缺口，不用“无 Actions 依赖”冒充“Actions 状态已验收”。
