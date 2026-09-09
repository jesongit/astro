import { describe, expect, it } from "vitest";
import {
  classifyAssetPlatform,
  mapLatestRelease,
} from "@/lib/portfolio/releases";

describe("classifyAssetPlatform(计划 §7.4)", () => {
  it("Windows:exe/msi 或明确 win/windows", () => {
    expect(classifyAssetPlatform("Aurora.Setup.2.4.0.exe")).toBe("windows");
    expect(classifyAssetPlatform("Aurora-2.4.0-win-x64.msi")).toBe("windows");
    expect(classifyAssetPlatform("app-1.0-windows.zip")).toBe("windows");
  });

  it("macOS:dmg/pkg 或 mac/darwin", () => {
    expect(classifyAssetPlatform("Aurora-2.4.0-macos-universal.dmg")).toBe(
      "macos"
    );
    expect(classifyAssetPlatform("shiguang-1.3.1-darwin-arm64.tar.gz")).toBe(
      "macos"
    );
    expect(classifyAssetPlatform("setup.pkg")).toBe("macos");
  });

  it("Linux:AppImage/deb/rpm 或明确 linux", () => {
    expect(classifyAssetPlatform("Aurora-2.4.0-linux-x86_64.AppImage")).toBe(
      "linux"
    );
    expect(classifyAssetPlatform("aurora_2.4.0_amd64.deb")).toBe("linux");
    expect(classifyAssetPlatform("app-1.0.rpm")).toBe("linux");
  });

  it("darwin 不因包含 win 子串而误判 Windows", () => {
    const result = classifyAssetPlatform("shiguang-1.3.1-darwin-arm64.tar.gz");
    expect(result).toBe("macos");
  });

  it("冲突线索归 other 并保留原名,不猜", () => {
    expect(classifyAssetPlatform("app-linux-win-universal.dmg")).toBe("other");
  });

  it("通用 zip/tar.gz 无线索归 other", () => {
    expect(classifyAssetPlatform("theme-gallery-pack.zip")).toBe("other");
    expect(classifyAssetPlatform("src.tar.gz")).toBe("other");
  });

  it("校验和/签名/SBOM 归 checksum,不作为推荐安装包", () => {
    expect(classifyAssetPlatform("SHA256SUMS.txt")).toBe("checksum");
    expect(classifyAssetPlatform("release.sig")).toBe("checksum");
    expect(classifyAssetPlatform("app.spdx.sbom")).toBe("checksum");
  });
});

describe("mapLatestRelease", () => {
  const asset = (over: Record<string, unknown>) => ({
    name: "a.exe",
    state: "uploaded",
    size: 1024,
    content_type: "application/octet-stream",
    browser_download_url: "https://github.com/x/x/releases/download/v1/a.exe",
    ...over,
  });

  it("映射正式版本与附件", () => {
    const { state, release } = mapLatestRelease({
      tag_name: "v2.4.0",
      published_at: "2026-08-12T04:00:00Z",
      html_url: "https://github.com/x/releases/tag/v2.4.0",
      zipball_url: "https://github.com/x/x/zipball/v2.4.0",
      tarball_url: "https://github.com/x/x/tarball/v2.4.0",
      assets: [
        asset({ name: "Aurora.Setup.2.4.0.exe" }),
        asset({ name: "uploading.exe", state: "uploader" }),
      ],
    });
    expect(state).toBe("present");
    expect(release?.tagName).toBe("v2.4.0");
    expect(release?.assets).toHaveLength(1); // 未完成上传的附件被过滤
    expect(release?.assets[0]?.platform).toBe("windows");
    expect(release?.sourceZipUrl).toContain("zipball");
    expect(release?.sourceTarUrl).toContain("tarball");
  });

  it("draft/prerelease 按异常处理", () => {
    expect(mapLatestRelease({ tag_name: "v1", prerelease: true }).state).toBe(
      "error"
    );
  });

  it("结构异常返回 error", () => {
    expect(mapLatestRelease({}).state).toBe("error");
    expect(mapLatestRelease(null).state).toBe("error");
  });

  it("无 published_at 时留空,不用 created_at 冒充", () => {
    const { release } = mapLatestRelease({ tag_name: "v1", assets: [] });
    expect(release?.publishedAt).toBe("");
  });
});
