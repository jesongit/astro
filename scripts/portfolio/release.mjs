/** GitHub Releases -> v1 ProjectRelease, without guessing versions or URLs. */
import { renderMarkdown } from "./projection.mjs";

export function classifyAssetPlatform(name) {
  const lower = String(name).toLowerCase();
  if (
    /(^|[^a-z])checksums?([^a-z]|$)/.test(lower) ||
    /sha\d+(sums?)?(\.|-)/.test(lower) ||
    /sha\d+\.txt/.test(lower) ||
    /\.(sig|minisig|sbom|pem|asc)$/.test(lower)
  ) {
    return "checksum";
  }
  const matches = [];
  if (/\.(exe|msi)$|(^|[^a-z])(win|windows)([^a-z]|$)/.test(lower)) {
    matches.push("windows");
  }
  if (/\.(dmg|pkg)$|(^|[^a-z])(mac|macos|osx|darwin)([^a-z]|$)/.test(lower)) {
    matches.push("macos");
  }
  if (/\.(appimage|deb|rpm|flatpak)$|(^|[^a-z])linux([^a-z]|$)/.test(lower)) {
    matches.push("linux");
  }
  return matches.length === 1 ? matches[0] : "other";
}

const isHttps = value =>
  typeof value === "string" && value.startsWith("https://");

export function normalizeReleaseAssets(rawAssets) {
  if (!Array.isArray(rawAssets)) return [];
  return rawAssets
    .filter(
      item =>
        item &&
        typeof item === "object" &&
        item.state === "uploaded" &&
        typeof item.browser_download_url === "string" &&
        isHttps(item.browser_download_url)
    )
    .map(item => ({
      name: typeof item.name === "string" && item.name ? item.name : "asset",
      sizeBytes:
        typeof item.size === "number" && Number.isFinite(item.size)
          ? Math.max(0, item.size)
          : 0,
      url: item.browser_download_url,
      platform: classifyAssetPlatform(item.name ?? "asset"),
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.url.localeCompare(b.url));
}

export async function mapLatestRelease(payload, rawAssets = undefined) {
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.tag_name !== "string"
  ) {
    return { state: "error", release: null };
  }
  if (payload.draft === true || payload.prerelease === true) {
    return { state: "error", release: null };
  }
  const notes =
    typeof payload.body === "string"
      ? (await renderMarkdown(payload.body)).textPlain
          .split("\n")
          .filter(line => line.trim())
          .slice(0, 10)
      : [];
  const assets = normalizeReleaseAssets(
    rawAssets === undefined ? payload.assets : rawAssets
  );
  const sourceZipUrl = isHttps(payload.zipball_url)
    ? payload.zipball_url
    : undefined;
  const sourceTarUrl = isHttps(payload.tarball_url)
    ? payload.tarball_url
    : undefined;
  return {
    state: "present",
    release: {
      tagName: payload.tag_name,
      publishedAt:
        typeof payload.published_at === "string" ? payload.published_at : "",
      notes,
      assets,
      releaseUrl: isHttps(payload.html_url)
        ? payload.html_url
        : isHttps(payload.url)
          ? payload.url
          : "",
      sourceZipUrl,
      sourceTarUrl,
    },
  };
}
