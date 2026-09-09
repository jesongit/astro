/**
 * GitHub Releases 展示规则(计划 §7.4):
 * - 最新正式版本采用 /releases/latest 的定义,不自行按 tag 排序;
 * - 只接受 state=uploaded 的真实附件;
 * - 平台/架构从实际名称与扩展名识别,冲突线索归「其他附件」并保留原名,不猜;
 * - 校验和/签名/SBOM 归「校验与其他文件」;
 * - GitHub 自动 source zip/tar 单列「源代码」,不作为安装包。
 */
import type { ProjectPlatform, ProjectRelease, ReleaseState } from "./types";

export function classifyAssetPlatform(name: string): ProjectPlatform {
  const lower = name.toLowerCase();

  // 校验和/签名/SBOM 优先识别
  if (
    /(^|[^a-z])checksums?([^a-z]|$)/.test(lower) ||
    /sha\d+(sums?)?(\.|-)/.test(lower) ||
    /sha\d+\.txt/.test(lower) ||
    /\.(sig|minisig|sbom|pem|asc)$/.test(lower)
  ) {
    return "checksum";
  }

  const windows = /\.(exe|msi)$|(^|[^a-z])(win|windows)([^a-z]|$)/.test(lower);
  const macos = /\.(dmg|pkg)$|(^|[^a-z])(mac|macos|osx|darwin)([^a-z]|$)/.test(
    lower
  );
  const linux = /\.(appimage|deb|rpm|flatpak)$|(^|[^a-z])linux([^a-z]|$)/.test(
    lower
  );

  const matches: ProjectPlatform[] = [];
  if (windows) matches.push("windows");
  if (macos) matches.push("macos");
  if (linux) matches.push("linux");

  if (matches.length === 1) return matches[0];
  // 无线索(通用 zip/tar.gz)或冲突线索:归「其他附件」,不能猜
  return "other";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * 将 /releases/latest 的响应映射为展示数据。
 * 返回 state:present(有正式版)/ none(payload 不完整)/ error(结构异常)。
 * 404(无 Release)由调用方处理为 { state:"none", release:null }。
 */
export function mapLatestRelease(payload: unknown): {
  state: ReleaseState;
  release: ProjectRelease | null;
} {
  if (!isRecord(payload) || typeof payload.tag_name !== "string") {
    return { state: "error", release: null };
  }
  if (payload.draft === true || payload.prerelease === true) {
    // latest 端点不应返回预发布;出现即按异常处理,不展示
    return { state: "error", release: null };
  }

  const rawAssets = Array.isArray(payload.assets) ? payload.assets : [];
  const assets = rawAssets.flatMap(item => {
    if (!isRecord(item)) return [];
    if (item.state !== "uploaded") return []; // 只接受真实上传完成的附件
    const url = item.browser_download_url;
    if (typeof url !== "string" || !/^https:\/\//.test(url)) return [];
    const name = typeof item.name === "string" ? item.name : "asset";
    return [
      {
        name,
        sizeBytes: typeof item.size === "number" ? item.size : 0,
        url,
        platform: classifyAssetPlatform(name),
      },
    ];
  });

  const findSource = (label: string): string | undefined => {
    const found = rawAssets.find(
      item =>
        isRecord(item) &&
        typeof item.name === "string" &&
        item.name.includes(label) &&
        typeof item.browser_download_url === "string" &&
        /^https:\/\//.test(String(item.browser_download_url))
    );
    return found
      ? String((found as Record<string, unknown>).browser_download_url)
      : undefined;
  };

  // GitHub 自动 source zip/tar 来自 release 级 zipball/tarball 字段,
  // 不是上传附件;单列「源代码」,不作为安装包(计划 §7.4)
  const sourceZipUrl =
    typeof payload.zipball_url === "string" &&
    /^https:\/\//.test(payload.zipball_url)
      ? payload.zipball_url
      : findSource("Source code (zip)");
  const sourceTarUrl =
    typeof payload.tarball_url === "string" &&
    /^https:\/\//.test(payload.tarball_url)
      ? payload.tarball_url
      : findSource("Source code (tar.gz)");

  const release: ProjectRelease = {
    tagName: payload.tag_name,
    publishedAt:
      typeof payload.published_at === "string" ? payload.published_at : "",
    notes: [], // Release Notes 由调用方清洗后填入
    assets,
    releaseUrl:
      typeof payload.html_url === "string"
        ? payload.html_url
        : typeof payload.url === "string"
          ? payload.url
          : "",
    sourceZipUrl,
    sourceTarUrl,
  };
  return { state: "present", release };
}
