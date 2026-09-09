/**
 * 安全 Markdown 管线(计划 §7.3):
 * GitHub README / Release Notes / 增强正文一律按不可信外部内容处理。
 * 禁止 raw HTML 注入、脚本、iframe、表单、style、事件属性与危险协议;
 * 相对链接/图片由调用方注入的 resolveUrl 解析(同 commit blob/raw 地址)。
 * 纯逻辑模块:Workers 与 Node 均可运行。
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import type { Root, RootContent } from "hast";
import { LIMITS } from "./config";

export const SANITIZER_VERSION = "md-v1-2026-09";

/** 在默认 GitHub 级 Schema 上收紧协议:外链 http(s)/mailto,图片仅 https */
const sanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["https"],
  },
};

type ResolveUrl = (url: string, isImage: boolean) => string;

function rehypeResolveUrls(resolve: ResolveUrl) {
  return (tree: Root) => {
    const walk = (node: Root | RootContent) => {
      if (!("children" in node)) return;
      const props = (node as { properties?: Record<string, unknown> })
        .properties;
      if (props) {
        if (typeof props.src === "string") {
          props.src = resolve(props.src, true);
        }
        if (typeof props.href === "string") {
          props.href = resolve(props.href, false);
        }
      }
      for (const child of node.children) walk(child);
    };
    walk(tree);
  };
}

const BLOCK_TAGS =
  /<\/?(p|div|ul|ol|li|table|tr|h[1-6]|blockquote|pre|hr|figure|figcaption)\b[^>]*>/gi;

/** 清洗后 HTML → 纯文本(实体解码 + 块级换行 + 空白折叠) */
export function htmlToText(html: string): string {
  const text = html
    .replace(BLOCK_TAGS, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&hellip;/gi, "…");
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join("\n");
}

/** 按 Unicode 字符截断,超长以省略号结尾(计划 §4.2) */
export function truncateChars(text: string, maxChars: number): string {
  const chars = [...text];
  if (chars.length <= maxChars) return text;
  return `${chars.slice(0, maxChars).join("")}…`;
}

export interface RenderOptions {
  /** 相对地址解析;默认原样返回(只接受绝对地址) */
  resolveUrl?: ResolveUrl;
}

export async function renderMarkdown(
  markdown: string,
  options: RenderOptions = {}
): Promise<{ html: string; textPlain: string }> {
  const resolve: ResolveUrl = options.resolveUrl ?? (url => url);
  const pipeline = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeResolveUrls, resolve)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify);
  const file = await pipeline.process(markdown);
  const html = String(file);
  return { html, textPlain: htmlToText(html) };
}

/** 基础模式摘要:README 纯文本按 Unicode 字符截断(§4.2:去除徽章/代码/图片/链接语法) */
export function summarizePlainText(markdown: string): string {
  const stripped = markdown
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // 链接保留文本
    .replace(/^===+$/gm, " ")
    .replace(/<[^>]*>/g, " ");
  const text = htmlToText(stripped).replace(/\n/g, " ");
  return truncateChars(text.trim(), LIMITS.readmeSummaryChars);
}
