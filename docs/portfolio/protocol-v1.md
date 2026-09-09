# 作品增强配置协议 v1

> 线上权威来源:`/api/portfolio/spec.json`(规范目录)、
> `/api/portfolio/schema/v1.json`(JSON Schema)、
> `/api/portfolio/prompt.txt`(可复制提示词)。
> v1 语义冻结;任何不兼容改动必须新增 v2 及对应 Schema URL,不修改 v1。

## 总览

作品内容有两个模式:

- **基础模式**(默认):仓库不需要任何文件。内容来自 GitHub 事实
  (name、description、topics、language、license、stars)与安全渲染的 README,
  版本与附件来自 GitHub Releases。
- **增强模式**(可选):仓库默认分支存在 `.portfolio/portfolio.json` 且通过校验时,
  按字段覆盖基础内容。配置损坏保留上一份有效增强内容(LKG);
  配置删除视为主动退出,回退基础内容。

文件不影响发布状态:展示/精选/排序仅由网站管理页决定,
版本与附件只来自 GitHub Releases,AI 与配置文件均无权提供。

同步链路只读取 GitHub 公开 REST 事实和可选配置，不要求项目启用 GitHub Actions，
也不把 Actions run 状态作为 v1 的发布条件或健康状态。若未来需要展示 Actions
状态，必须新增明确的数据契约和测试，不得把它混入 v1 配置文件。

## 文件位置

固定入口为默认分支 `.portfolio/portfolio.json`。其他文件按引用读取
(`bodyFile`、`cover.path`、`screenshots[].path`),不遍历仓库、不执行任何脚本。

## 字段与默认规则

| 字段 | 覆盖与默认规则 |
| --- | --- |
| `title` | 非空增强值 > GitHub `name` |
| `summary` | 非空增强值 > Description > README 文本摘要 > 固定缺省句 |
| `bodyFile` | 有效引用 Markdown > README;省略表示使用 README;空字符串无效 |
| `features` | 增强数组整体替换,默认 `[]`,不自动推断 |
| `techStack` | 整体替换;省略时仅使用已知 GitHub language;`[]` 明确隐藏 |
| `links.website` | 增强 HTTPS URL > 经校验的 homepage;`null` 明确隐藏;省略则回退 |
| `links.demo` / `links.docs` | 增强有效 URL,否则无;`null` 隐藏 |
| `cover` / `screenshots` | 默认无封面 / `[]`;`null` 明确无封面;列表整体替换 |
| `additionalDownloads` | 默认 `[]`;只补充真实外部渠道,不覆盖 Releases 附件 |
| GitHub Topics / owner / license / stars 等 | 始终来自 GitHub,不可覆盖 |
| visible / featured / order / slug / 版本 / 发布日期 | 不属于本协议,写入即校验失败 |

删除字段必须生效:新配置缺失的字段不会从上一份配置深合并回来。

## 容量限制

| 项 | 上限 |
| --- | --- |
| portfolio.json | 32 KiB |
| 增强正文(bodyFile 渲染前) | 128 KiB |
| 单张图片 | 2 MiB |
| 截图合计 | 8 MiB |
| README(超出截断并提示) | 256 KiB |

图片仅允许 `.portfolio/assets/` 下 `png / jpg / jpeg / webp`;
`width`/`height` 必须成对且与图片实际尺寸一致,否则省略或报错。

## 安全校验

结构校验使用 AJV 2020 + ajv-formats;语义层额外拒绝:

- 重复 JSON 键;
- 非公网 HTTPS URL(禁止凭据、回环、私网、`.local/.internal`);
- 路径穿越(`..`)、反斜线、百分号编码;
- 未知字段(根级或 links/image 内未知键使整份配置失效);
- Markdown 渲染统一走安全管线:禁止 raw HTML、脚本、iframe、表单、
  style、事件属性与危险协议;相对图片解析为同 commit raw 地址(仅 HTTPS)。

## 发布门禁(与本协议的关系)

作品公开需要同时满足:管理员 `visible=true`;最新观察证明仓库公开且 owner
在许可范围;公开状态验证仍在 30 分钟有效期内;不存在未确认的撤下事件;
内容 payload 可读。任一条件不满足,详情 404/503,列表/搜索/sitemap 同步移除。

## 存储与部署边界

同步 Worker 只写 `v1:obs:*`、`v1:payload:*`、`v1:incident:*`、`v1:inventory:*`
以及运行/任务结果记录；管理 API 才能写 `v1:settings:*` 和任务请求。读取方不
兼容旧 key、旧 Worker 或旧 Cron 的数据格式，避免旧资源在回滚或迁移期间重新
上架。旧云端资源的停用或删除不属于协议发布步骤，必须由有权限的操作者单独
审批和执行。
