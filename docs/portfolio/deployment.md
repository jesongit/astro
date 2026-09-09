# 作品系统部署与上线顺序

> 代码侧验收入口和未完成项见 [验收矩阵](./acceptance-matrix.md)。
> 本文档列出的账号侧步骤必须由拥有 Cloudflare 权限的操作者执行;
> 任何 ID、audience、邮箱或部署 ID 都以目标环境实际值为准,禁止凭猜测填写。
> 本次代码交付不执行 Cloudflare 资源创建、修改、停用或删除。

## 1. 已知部署形态(只读记录)

现有站点为 **Cloudflare Pages**(Git 集成,推 main 自动构建):

| 项 | 实际值 |
| --- | --- |
| 项目名 | `astro`(自定义域:`posase.im` + `astro-dz6.pages.dev`) |
| 生产分支 | `main` |
| 构建命令 | `npm run build` |
| Node 版本 | 22.16.0 |
| 输出目录 | `dist` |
| 环境变量 | 无(secret 见 §7) |
| 回滚基线部署 ID | `ebcf1554-8b07-450b-8666-8e894f4f58c2` |

> ⚠️ 站点实际运行在**裸域 `posase.im`**:`www.posase.im` 无 DNS 记录
> (NXDOMAIN),本文旧版写的 `www.posase.im` 为计划期假设,以本节为准。
> `src/config.ts` 的 `SITE.website` 与 schema `$id` 已随之改为裸域。

## 2. 需要填写的配置占位

### `wrangler.jsonc`(站点)

| 字段 | 填写 |
| --- | --- |
| `name` | 现有 Pages 项目名 |
| `kv_namespaces[].id`(生产) | PORTFOLIO_CONTROL / PORTFOLIO_CACHE / PORTFOLIO_JOBS 三个生产 namespace ID |
| `env.preview.kv_namespaces[].id` | 预览环境独立的三套 ID(绝不复用生产) |
| `vars.ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` | Access team host 与 application audience |
| `vars.ADMIN_ALLOWED_HOSTS` | `posase.im` |
| `vars.ADMIN_EMAILS` | 管理员邮箱(CSV) |

> Access 按 `/admin` 与 `/api/admin` 各建一个 self-hosted 应用,
> 两个应用 aud 不同,故 `ACCESS_AUD` 为 CSV 双值;代码侧已支持多值
> (`src/lib/auth/access.ts` 的 `aud: string[]`)。

secret(控制台配置,不入库):`CSRF_SECRET`(强随机,`openssl rand -base64 32`)。

### `workers/portfolio-sync/wrangler.jsonc`(同步 Worker)

- 三个 KV namespace ID 与站点**同环境同 ID**;
- 变量 `GITHUB_OWNER=jesongit`、`GITHUB_OWNER_TYPE=user`、
  `GITHUB_API_VERSION=2026-03-10`(端点契约确认后锁定);
- secret:`GITHUB_TOKEN`(细粒度只读 PAT:公开仓库 Metadata/Contents 读取,
  无写权限、无私有仓库权限、无 Actions 权限);
- `SYNC_ENABLED` 保持 `"false"` 直到生产验收完成。

## 3. Cloudflare Access(阶段 4)

1. 创建 self-hosted Access Application,覆盖:
   `/admin`、`/admin/*`、`/api/admin`、`/api/admin/*`(注意无尾斜线路径);
2. 策略:仅管理员邮箱 Allow,不配置 Bypass/Everyone;
3. 预览环境建独立 Application 与测试邮箱,绝不绑定生产 KV;
4. 把 team domain 与 application audience 填入两份 wrangler 配置。

## 4. KV namespace 创建

生产与预览各一套(共 6 个):`PORTFOLIO_CONTROL` / `PORTFOLIO_CACHE` / `PORTFOLIO_JOBS`。
CONTROL 与 CACHE/JOBS 写权限隔离由代码保证(同步 Worker 无 CONTROL 写路径)。

## 5. 上线顺序(需单独授权执行)

1. 构建基线归档:记录文章 URL 清单与本次构建 ID;
2. 建预览 KV + Access 预览应用 + 只读 GitHub token,部署 `SYNC_ENABLED=false` 的 Worker;
3. 预览环境:人工选中 1 个基础模式、1 个增强模式、1 个无 Release 项目,
   验证内容、Release、下架与搜索;
4. 生产配置 KV/Access/secrets → 部署受保护站点 → 验证 `/admin`、`/api/admin`
   未鉴权均被拒(401/403)→ 再开 Cron;
5. 管理页按确定清单显式展示/精选,确认两个地区可见后完成验收;
6. 保留最近可用部署 ID 与 CONTROL 加密导出(§14.3 回滚依据),凭据只保存在受控
   密钥系统中,不得写入仓库、日志、验收输出或截图。

## 6. 已知边界(如实告知)

- KV 是最终一致存储:正常撤下目标为 10 分钟检查周期 + KV 传播时间,
  不是全球即时 SLA(§8.4);
- 本地 `workerd` 测试池兼容日期上限为 2025-09-06,生产配置为 2026-09-08,
  上线前需在真实环境跑一次 `wrangler pages dev` 与预览 Worker 验证;
- 首次生产同步前首页作品区为空状态,属预期行为(§11.1)。
- GitHub Actions 不在 v1 同步链路中;当前没有 Actions run 状态数据源或管理展示。
  需要该能力时先补契约、权限和验收，不把工作流状态当作现有同步成功的替代品。
- 代码只使用当前 v1 版本化 key 和当前 Worker 入口，不读取旧 KV/Worker/Cron 格式；
  旧云端资源的清理另需审批，本次不执行。
