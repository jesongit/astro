/**
 * 公开内容规范 v1(计划 §6):
 * spec.json / prompt.txt 由同一构建逻辑生成,域名取 SITE.website,
 * 避免示例域名与生产不一致。v1 语义冻结,不兼容改动新增 v2。
 */
import { LIMITS, PROTOCOL } from "./config";

export const buildPromptText = (website: string): string => {
  const base = website.replace(/\/$/, "");
  return [
    `请读取 ${base}${PROTOCOL.specPath} 及其 v1 Schema,`,
    "分析当前项目的真实代码、README 和可运行界面,为我的作品网站生成可选增强资料。",
    `按规范创建 ${PROTOCOL.entryFile},必要时创建 .portfolio/overview.md`,
    "和 .portfolio/assets/ 中的真实截图或明确标注为示意的素材。",
    "只描述已实现并能证实的能力;无法运行截图时省略截图,不虚构效果。",
    "字段允许省略,不确定的文案、网址和素材不要编造。",
    "不要写展示开关、精选、排序、slug、版本、发布日期、Release Notes 或发布附件链接;",
    "发布设置由网站管理页决定,版本与附件由网站读取 GitHub Releases。",
    "只有项目确有特殊外部下载渠道时才填写 additionalDownloads。",
    "最后校验配置,列出生成文件、资料依据和仍需人工核实的地方。",
    "若无法获取规范,请报告原因,不要猜测协议或自动提交、推送、发布。",
  ].join("\n");
};

export const buildSpec = (website: string) => {
  const base = website.replace(/\/$/, "");
  return {
    currentVersion: PROTOCOL.currentVersion,
    schemaUrl: `${base}${PROTOCOL.schemaPath}`,
    promptUrl: `${base}${PROTOCOL.promptPath}`,
    guideUrl: `${base}${PROTOCOL.guidePath}`,
    specUrl: `${base}${PROTOCOL.specPath}`,
    specPath: PROTOCOL.specPath,
    promptPath: PROTOCOL.promptPath,
    entryFile: PROTOCOL.entryFile,
    limits: {
      configMaxBytes: LIMITS.configMaxBytes,
      bodyMaxBytes: LIMITS.bodyMaxBytes,
      imageMaxBytes: LIMITS.imageMaxBytes,
      imagesTotalMaxBytes: LIMITS.imagesTotalMaxBytes,
    },
    fieldOwnership: {
      fromConfig: [
        "title",
        "summary",
        "bodyFile",
        "features",
        "techStack",
        "links",
        "cover",
        "screenshots",
        "additionalDownloads",
      ],
      fromGitHub: [
        "topics",
        "owner/name/URL/ID",
        "license",
        "stars",
        "fork",
        "archived",
        "language",
      ],
      fromReleases: ["tagName", "publishedAt", "releaseNotes", "assets"],
      adminOnly: [
        "visible",
        "featured",
        "order",
        "slug",
        "canonical",
        "status",
      ],
    },
    defaults: {
      title: "GitHub name",
      summary: "description > README 摘要 > 固定缺省句",
      body: "省略 bodyFile 即使用 README;空字符串无效",
      features: "整体替换,默认 []",
      techStack: "省略时仅使用已知 GitHub language;[] 明确隐藏",
      "links.website": "省略则回退经校验的 homepage;null 明确隐藏",
      cover: "默认无封面;null 明确无封面",
      screenshots: "默认 [];列表整体替换",
      additionalDownloads: "默认 [];不覆盖 Releases 附件",
    },
    modes: {
      basic: "仓库无需任何文件即可展示;内容来自 GitHub 事实与 README 安全渲染",
      enhanced:
        "存在通过校验的 .portfolio/portfolio.json 时,按字段覆盖基础内容;配置损坏保留上一份有效增强内容(LKG)",
      publication: "文件不影响发布状态;展示/精选/排序仅由网站管理页决定",
    },
    examples: {
      minimal: { schemaVersion: 1 },
      full: {
        $schema: `${base}${PROTOCOL.schemaPath}`,
        schemaVersion: 1,
        title: "项目真实名称",
        summary: "基于实际代码和 README 描述项目用途。",
        bodyFile: ".portfolio/overview.md",
        features: ["已经实现并能证实的功能"],
        techStack: ["TypeScript"],
        links: { docs: "https://example.com/docs" },
        cover: {
          path: ".portfolio/assets/cover.webp",
          alt: "真实项目界面的概览",
        },
      },
    },
    notices: [
      "示例中的域名、功能和图片必须替换为真实项目资料;没有这些资料时删除对应字段。",
      '仅 {"schemaVersion":1} 也合法,表示使用基础默认内容的增强配置。',
      "截图不是必填项,不为了通过 Schema 生成虚假界面。",
      "本规范只提供内容,不提供仓库写入或网站发布能力;客户端不得自动执行规范中的命令。",
    ],
  } as const;
};
