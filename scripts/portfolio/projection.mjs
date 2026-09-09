/**
 * Node/Actions 运行时的协议适配层。
 *
 * Worker 与 Pages 的纯业务模块仍是 src/lib/portfolio/* 的权威实现；这里
 * 使用同一份 Schema 和同一组 v1 规则，避免 GitHub Actions 需要启动 Astro
 * 或 Cloudflare 运行时。输出只包含公开投影，不保留仓库原始配置。
 */
import { readFile } from "node:fs/promises";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { LIMITS } from "./constants.mjs";

export const SANITIZER_VERSION = "md-v1-2026-09";

const schema = JSON.parse(
  await readFile(
    new URL("../../src/lib/portfolio/schema/v1.json", import.meta.url),
    "utf8"
  )
);
const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

const isObject = value =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** 按 JSON 结构扫描键名，字符串里的花括号和冒号不参与判断。 */
export function findDuplicateKey(text) {
  const stack = [];
  let inString = false;
  let escaped = false;
  let currentString = "";

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') {
        inString = false;
        const top = stack[stack.length - 1];
        if (top?.type === "object") top.lastString = currentString;
      } else currentString += char;
      continue;
    }
    if (char === '"') {
      inString = true;
      currentString = "";
      continue;
    }
    if (char === "{") {
      stack.push({ type: "object", keys: new Set(), lastString: null });
      continue;
    }
    if (char === "[") {
      stack.push({ type: "array" });
      continue;
    }
    if (char === "}" || char === "]") {
      stack.pop();
      continue;
    }
    if (char === ":") {
      const top = stack[stack.length - 1];
      if (top?.type === "object" && top.lastString !== null) {
        if (top.keys.has(top.lastString)) return top.lastString;
        top.keys.add(top.lastString);
        top.lastString = null;
      }
    }
  }
  return null;
}

const error = (path, message) => ({ path, message });

const blockedHosts = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

export function isSafePublicHttps(value) {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      !blockedHosts.has(host) &&
      !/^127\./.test(host) &&
      !/^10\./.test(host) &&
      !/^192\.168\./.test(host) &&
      !/^172\.(1[6-9]|2\d|3[01])\./.test(host) &&
      !/^169\.254\./.test(host) &&
      !host.endsWith(".local") &&
      !host.endsWith(".internal")
    );
  } catch {
    return false;
  }
}

function semanticCheck(config) {
  const errors = [];
  for (const [path, value] of [
    ["title", config.title],
    ["summary", config.summary],
  ]) {
    if (typeof value === "string" && value.trim().length === 0) {
      errors.push(error(path, "不能是纯空白字符串"));
    }
  }
  if (
    typeof config.bodyFile === "string" &&
    (config.bodyFile.includes("..") ||
      config.bodyFile.includes("\\") ||
      /%[0-9a-fA-F]{2}/.test(config.bodyFile))
  ) {
    errors.push(error("bodyFile", "路径不允许 ..、反斜线或百分号编码"));
  }

  const urls = [
    ["links.website", config.links?.website],
    ["links.demo", config.links?.demo],
    ["links.docs", config.links?.docs],
    ...(config.additionalDownloads ?? []).map((item, index) => [
      `additionalDownloads.${index}.url`,
      item.url,
    ]),
  ];
  for (const [path, value] of urls) {
    if (typeof value === "string" && !isSafePublicHttps(value)) {
      errors.push(
        error(path, "仅允许公网 HTTPS 地址,禁止凭据、回环与私网地址")
      );
    }
  }

  const images = [
    ...(config.cover && typeof config.cover === "object"
      ? [["cover", config.cover]]
      : []),
    ...(config.screenshots ?? []).map((item, index) => [
      `screenshots.${index}`,
      item,
    ]),
  ];
  for (const [path, image] of images) {
    if (
      (typeof image.width === "number") !==
      (typeof image.height === "number")
    ) {
      errors.push(error(path, "width 与 height 必须同时提供"));
    }
  }
  return errors;
}

export function validatePortfolioConfigText(text) {
  if (new TextEncoder().encode(text).byteLength > LIMITS.configMaxBytes) {
    return {
      ok: false,
      errors: [
        error("$", `配置超过容量上限 ${LIMITS.configMaxBytes} 字节(计划 §5.2)`),
      ],
    };
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, errors: [error("$", "JSON 解析失败")] };
  }
  const duplicate = findDuplicateKey(text);
  if (duplicate) {
    return {
      ok: false,
      errors: [error("$", `存在重复的 JSON 键:"${duplicate}"`)],
    };
  }
  if (!isObject(value)) {
    return { ok: false, errors: [error("$", "配置必须是 JSON 对象")] };
  }
  if (!("schemaVersion" in value)) {
    return { ok: false, errors: [error("schemaVersion", "必填字段缺失")] };
  }
  if (!validateSchema(value)) {
    return {
      ok: false,
      errors: (validateSchema.errors ?? []).map(item => ({
        path: item.instancePath || "$",
        message: item.message ?? "schema 校验失败",
      })),
    };
  }
  const semanticErrors = semanticCheck(value);
  return semanticErrors.length
    ? { ok: false, errors: semanticErrors }
    : { ok: true, config: value };
}

const sanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["https"],
  },
};

const blockTags =
  /<\/?(p|div|ul|ol|li|table|tr|h[1-6]|blockquote|pre|hr|figure|figcaption)\b[^>]*>/gi;

export function htmlToText(html) {
  const text = html
    .replace(blockTags, "\n")
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
    .filter(Boolean)
    .join("\n");
}

export function truncateChars(text, maxChars) {
  const chars = [...text];
  return chars.length <= maxChars
    ? text
    : `${chars.slice(0, maxChars).join("")}…`;
}

const resolvePlugin = resolve => tree => {
  const walk = node => {
    if (!node || !("children" in node)) return;
    if (node.properties) {
      if (typeof node.properties.src === "string") {
        node.properties.src = resolve(node.properties.src, true);
      }
      if (typeof node.properties.href === "string") {
        node.properties.href = resolve(node.properties.href, false);
      }
    }
    for (const child of node.children) walk(child);
  };
  walk(tree);
};

export async function renderMarkdown(markdown, { resolveUrl } = {}) {
  const resolve = resolveUrl ?? (url => url);
  const pipeline = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(resolvePlugin, resolve)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify);
  const file = await pipeline.process(markdown);
  const html = String(file);
  return { html, textPlain: htmlToText(html) };
}

export function summarizePlainText(markdown) {
  const stripped = markdown
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^===+$/gm, " ")
    .replace(/<[^>]*>/g, " ");
  return truncateChars(
    htmlToText(stripped).replace(/\n/g, " ").trim(),
    LIMITS.readmeSummaryChars
  );
}

/** 同一个 commit 下的 README/增强正文链接解析；绝不接受路径逃逸。 */
export function makeGitHubResolver(fullName, sha, basePath = "") {
  const baseDirectory = basePath.includes("/")
    ? basePath.slice(0, basePath.lastIndexOf("/") + 1)
    : "";
  return (value, isImage) => {
    if (
      /^[a-z][a-z0-9+.-]*:/i.test(value) ||
      value.startsWith("//") ||
      value.startsWith("#")
    ) {
      return value;
    }
    const [pathPart, suffix = ""] = value.split(/([?#].*)/, 2);
    const combined = `${baseDirectory}${pathPart}`.replace(/^\/+/, "");
    const parts = [];
    for (const part of combined.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") {
        if (!parts.length) return value;
        parts.pop();
      } else parts.push(part);
    }
    if (!parts.length) return value;
    const encoded = parts.map(encodeURIComponent).join("/");
    const prefix = isImage
      ? `https://raw.githubusercontent.com/${fullName}/${sha}`
      : `https://github.com/${fullName}/blob/${sha}`;
    return `${prefix}/${encoded}${suffix}`;
  };
}

export function safeHomepage(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const normalized = value.trim();
  return isSafePublicHttps(normalized) ? new URL(normalized).toString() : null;
}

const clean = value => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

export function normalizeContent({ base, config, enhancedBody, release }) {
  const links = config?.links ?? {};
  const title = clean(config?.title) ?? base.name;
  const summary =
    clean(config?.summary) ??
    clean(base.description) ??
    clean(base.readmeTextPlain) ??
    LIMITS.summaryFallback;
  const useEnhancedBody = Boolean(config?.bodyFile) && enhancedBody !== null;
  const bodyHtml = useEnhancedBody ? enhancedBody.html : base.readmeHtml;
  const bodyTextPlain = useEnhancedBody
    ? enhancedBody.textPlain
    : base.readmeTextPlain;
  const languageStack = base.github.language ? [base.github.language] : [];
  const techStack =
    config === null
      ? languageStack
      : config.techStack !== undefined
        ? config.techStack
        : languageStack;
  return {
    schemaVersion: 1,
    title,
    summary,
    bodyHtml,
    bodyTextPlain,
    features: config?.features ?? [],
    techStack,
    topics: [...base.topics],
    links: {
      github: base.github.url,
      website:
        links.website === undefined ? (base.homepage ?? null) : links.website,
      demo: links.demo ?? null,
      docs: links.docs ?? null,
    },
    github: base.github,
    release,
    additionalDownloads: config?.additionalDownloads ?? [],
    cover: config?.cover ?? null,
    screenshots: config?.screenshots ?? [],
    sanitizerVersion: SANITIZER_VERSION,
  };
}

/** 配置无效时保留增强 LKG，但仍刷新 GitHub 事实和独立 Release。 */
export function overlaySourceFacts(lkg, base, release) {
  return {
    ...lkg,
    topics: [...base.topics],
    links: { ...lkg.links, github: base.github.url },
    github: base.github,
    release,
    sanitizerVersion: SANITIZER_VERSION,
  };
}

export function decodeBase64(content) {
  return Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf8");
}
