/**
 * 默认值与覆盖规则(计划 §5.3):
 * 先独立生成基础内容,再对本次完整有效的增强配置应用覆盖;
 * 缺失字段不从上一份增强配置深合并回来(删除字段必须生效)。
 * `config` 为已通过 validate 的配置,其中素材 path 已由调用方解析为可访问 src。
 */
import type {
  ConfigState,
  GitHubFacts,
  PortfolioContent,
  PortfolioMode,
  ProjectRelease,
} from "./types";
import { LIMITS } from "./config";

export interface BasicContentInput {
  /** GitHub name */
  name: string;
  description: string | null;
  /** 基础 README 经安全清洗后的 HTML(缺失为空串) */
  readmeHtml: string;
  /** README 纯文本摘要(≤ LIMITS.readmeSummaryChars 字符) */
  readmeTextPlain: string;
  topics: string[];
  github: GitHubFacts;
  /** 经校验的 homepage(HTTPS 公网地址)或 null */
  homepage: string | null;
}

export interface EnhancedBody {
  html: string;
  textPlain: string;
}

/** 增强配置(bodyFile)渲染结果为 null 时回退使用 README 正文 */
export interface NormalizeInput {
  base: BasicContentInput;
  config: PortfolioNormalizedConfig | null;
  enhancedBody: EnhancedBody | null;
  release: ProjectRelease | null;
  sanitizerVersion: string;
}

/** 与 PortfolioConfig 同形,但图片 path 已解析为 src */
export interface PortfolioNormalizedConfig {
  title?: string;
  summary?: string;
  bodyFile?: string;
  features?: string[];
  techStack?: string[];
  links?: {
    website?: string | null;
    demo?: string | null;
    docs?: string | null;
  };
  cover?: PortfolioContent["cover"];
  screenshots?: PortfolioContent["screenshots"];
  additionalDownloads?: PortfolioContent["additionalDownloads"];
}

/** 配置错误且有上一份有效增强内容时,effective mode 仍为 enhanced(§5.3) */
export function effectiveMode(
  configState: ConfigState,
  hasEnhancedLkg: boolean
): PortfolioMode {
  if (configState === "valid") return "enhanced";
  if (configState === "invalid" && hasEnhancedLkg) return "enhanced";
  return "basic";
}

const clean = (value: string | undefined | null): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function normalizeContent(input: NormalizeInput): PortfolioContent {
  const { base, config, enhancedBody, release, sanitizerVersion } = input;
  const configLinks = config?.links ?? {};

  const title = clean(config?.title) ?? base.name;

  const summary =
    clean(config?.summary) ??
    clean(base.description) ??
    clean(base.readmeTextPlain) ??
    LIMITS.summaryFallback;

  // 正文:声明 bodyFile 用增强正文;省略(或基础模式)用 README
  const useEnhancedBody = Boolean(config?.bodyFile) && enhancedBody !== null;
  const bodyHtml = useEnhancedBody ? enhancedBody!.html : base.readmeHtml;
  const bodyTextPlain = useEnhancedBody
    ? enhancedBody!.textPlain
    : base.readmeTextPlain;

  // features:整体替换,默认 [],不自动推断
  const features = config?.features ?? [];

  // techStack:配置省略时回退到已知 GitHub language;`[]` 表示明确隐藏
  const languageStack = base.github.language ? [base.github.language] : [];
  const techStack =
    config === null
      ? languageStack
      : config.techStack !== undefined
        ? config.techStack
        : languageStack;

  // website:省略则回退到经校验的 homepage;`null` 明确隐藏
  const websiteFallback = base.homepage ?? null;
  const website =
    configLinks.website === undefined ? websiteFallback : configLinks.website;

  return {
    schemaVersion: 1,
    title,
    summary,
    bodyHtml,
    bodyTextPlain,
    features,
    techStack,
    topics: base.topics, // 始终来自 GitHub Topics
    links: {
      github: base.github.url,
      website,
      demo: configLinks.demo ?? null,
      docs: configLinks.docs ?? null,
    },
    github: base.github,
    release,
    additionalDownloads: config?.additionalDownloads ?? [],
    cover: config?.cover ?? null,
    screenshots: config?.screenshots ?? [],
    sanitizerVersion,
  };
}
