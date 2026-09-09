/**
 * 增强配置校验(计划 §5.2):
 * 1) JSON 解析 + 拒绝重复键;
 * 2) AJV 2020 + formats 结构校验($defs 中的 $ref 均为文档内引用,不跟随外部地址,防 SSRF);
 * 3) 语义补充:trim 非空、URL 禁止凭据与回环/私网地址、width/height 成对、容量上限。
 *
 * Schema 的 default 仅为注释语义,默认值由 normalize.ts 实际应用。
 */
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schemaJson from "./schema/v1.json";
import { LIMITS } from "./config";

export interface PortfolioConfig {
  schemaVersion: 1;
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
  cover?: {
    path: string;
    alt: string;
    caption?: string;
    width?: number;
    height?: number;
  } | null;
  screenshots?: {
    path: string;
    alt: string;
    caption?: string;
    width?: number;
    height?: number;
  }[];
  additionalDownloads?: {
    label: string;
    url: string;
    kind: "store" | "package" | "external";
    description?: string;
  }[];
}

export interface ConfigError {
  path: string;
  message: string;
}

export type ConfigValidationResult =
  | { ok: true; config: PortfolioConfig }
  | { ok: false; errors: ConfigError[] };

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);
const validateSchema = ajv.compile<PortfolioConfig>(
  schemaJson as unknown as Record<string, unknown>
);

/** 解析 JSON 并拒绝重复键:扫描字符串外的主结构键名 */
export function parseJsonRejectingDuplicateKeys(
  text: string
): { ok: true; value: unknown } | { ok: false; error: string } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `JSON 解析失败:${(e as Error).message}` };
  }
  const dup = findDuplicateKey(text);
  if (dup) return { ok: false, error: `存在重复的 JSON 键:"${dup}"` };
  return { ok: true, value };
}

/** 按结构扫描:对象层级内出现两次的键即重复;字符串内的符号不参与结构 */
function findDuplicateKey(text: string): string | null {
  type Frame =
    | { type: "object"; keys: Set<string>; lastString: string | null }
    | { type: "array" };
  const stack: Frame[] = [];
  let inString = false;
  let escaped = false;
  let currentString = "";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
        const top = stack[stack.length - 1];
        if (top && top.type === "object") top.lastString = currentString;
      } else {
        currentString += ch;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      currentString = "";
      continue;
    }
    if (ch === "{") {
      stack.push({ type: "object", keys: new Set(), lastString: null });
      continue;
    }
    if (ch === "[") {
      stack.push({ type: "array" });
      continue;
    }
    if (ch === "}" || ch === "]") {
      stack.pop();
      continue;
    }
    if (ch === ":") {
      const top = stack[stack.length - 1];
      if (top && top.type === "object" && top.lastString !== null) {
        const key = top.lastString;
        if (top.keys.has(key)) return key;
        top.keys.add(key);
        top.lastString = null;
      }
    }
  }
  return null;
}

const BLOCKED_HOSTNAME = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

function isPrivateOrLoopbackUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }
  if (parsed.protocol !== "https:") return true;
  if (parsed.username || parsed.password) return true;
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAME.has(host)) return true;
  if (/^127\./.test(host) || /^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  return false;
}

const asErrors = (path: string, message: string): ConfigError => ({
  path,
  message,
});

function semanticCheck(config: PortfolioConfig): ConfigError[] {
  const errors: ConfigError[] = [];
  const stringsToCheck: [string, string | undefined][] = [
    ["title", config.title],
    ["summary", config.summary],
  ];
  for (const [path, value] of stringsToCheck) {
    if (typeof value === "string" && value.trim().length === 0) {
      errors.push(asErrors(path, "不能是纯空白字符串"));
    }
  }
  if (typeof config.bodyFile === "string") {
    if (config.bodyFile.includes("..") || config.bodyFile.includes("\\")) {
      errors.push(asErrors("bodyFile", "路径不允许 .. 或反斜线"));
    }
    if (/%[0-9a-fA-F]{2}/.test(config.bodyFile)) {
      errors.push(asErrors("bodyFile", "路径不允许百分号编码"));
    }
  }
  const urls: [string, string | undefined | null][] = [
    ["links.website", config.links?.website],
    ["links.demo", config.links?.demo],
    ["links.docs", config.links?.docs],
    ...(config.additionalDownloads ?? []).map(
      (d, i) => [`additionalDownloads.${i}.url`, d.url] as [string, string]
    ),
  ];
  for (const [path, url] of urls) {
    if (typeof url === "string" && isPrivateOrLoopbackUrl(url)) {
      errors.push(
        asErrors(path, "仅允许公网 HTTPS 地址,禁止凭据、回环与私网地址")
      );
    }
  }
  const images: [string, { width?: number; height?: number }][] = [
    ...(config.cover && typeof config.cover === "object"
      ? ([["cover", config.cover as { width?: number; height?: number }]] as [
          string,
          { width?: number; height?: number },
        ][])
      : []),
    ...(config.screenshots ?? []).map(
      (s, i) =>
        [`screenshots.${i}`, s] as [string, { width?: number; height?: number }]
    ),
  ];
  for (const [path, img] of images) {
    const hasW = typeof img.width === "number";
    const hasH = typeof img.height === "number";
    if (hasW !== hasH) {
      errors.push(asErrors(path, "width 与 height 必须同时提供"));
    }
  }
  return errors;
}

/** 校验入口:输入为原始 JSON 文本(容量上限在此检查) */
export function validatePortfolioConfigText(
  text: string
): ConfigValidationResult {
  if (new TextEncoder().encode(text).byteLength > LIMITS.configMaxBytes) {
    return {
      ok: false,
      errors: [
        asErrors(
          "$",
          `配置超过容量上限 ${LIMITS.configMaxBytes} 字节(计划 §5.2)`
        ),
      ],
    };
  }
  const parsed = parseJsonRejectingDuplicateKeys(text);
  if (!parsed.ok) {
    return { ok: false, errors: [asErrors("$", parsed.error)] };
  }
  const value = parsed.value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, errors: [asErrors("$", "配置必须是 JSON 对象")] };
  }
  if (
    !(value as Record<string, unknown>)["schemaVersion"] &&
    !("schemaVersion" in (value as Record<string, unknown>))
  ) {
    return { ok: false, errors: [asErrors("schemaVersion", "必填字段缺失")] };
  }
  const valid = validateSchema(value);
  if (!valid) {
    const errors = (validateSchema.errors ?? []).map(err => ({
      path: err.instancePath || "$",
      message: err.message ?? "schema 校验失败",
    }));
    return { ok: false, errors };
  }
  const semanticErrors = semanticCheck(value as PortfolioConfig);
  if (semanticErrors.length > 0) return { ok: false, errors: semanticErrors };
  return { ok: true, config: value as PortfolioConfig };
}
