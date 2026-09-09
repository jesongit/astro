import { describe, expect, it } from "vitest";
import {
  effectiveMode,
  normalizeContent,
  type BasicContentInput,
  type PortfolioNormalizedConfig,
} from "@/lib/portfolio/normalize";

const baseInput: BasicContentInput = {
  name: "aurora-theme",
  description: "GitHub 描述",
  readmeHtml: "<p>README 正文</p>",
  readmeTextPlain: "README 摘要",
  topics: ["astro", "blog-theme"],
  github: {
    fullName: "jesongit/aurora-theme",
    url: "https://github.com/jesongit/aurora-theme",
    stars: 10,
    license: "MIT",
    language: "TypeScript",
  },
  homepage: "https://example.com/",
};

const release = {
  tagName: "v1.0.0",
  publishedAt: "2026-01-01T00:00:00Z",
  notes: [],
  assets: [],
  releaseUrl: "https://github.com/jesongit/aurora-theme/releases/tag/v1.0.0",
};

describe("normalizeContent 覆盖规则(计划 §5.3)", () => {
  it("基础模式:title/summary/techStack/website 走默认链", () => {
    const content = normalizeContent({
      base: baseInput,
      config: null,
      enhancedBody: null,
      release: null,
      sanitizerVersion: "test",
    });
    expect(content.title).toBe("aurora-theme");
    expect(content.summary).toBe("GitHub 描述");
    expect(content.techStack).toEqual(["TypeScript"]);
    expect(content.links.website).toBe("https://example.com/");
    expect(content.features).toEqual([]);
    expect(content.bodyHtml).toBe("<p>README 正文</p>");
  });

  it("summary 回退链:配置 > 描述 > README 摘要 > 固定句", () => {
    const noDesc = { ...baseInput, description: null, readmeTextPlain: "RM" };
    expect(
      normalizeContent({
        base: noDesc,
        config: null,
        enhancedBody: null,
        release: null,
        sanitizerVersion: "t",
      }).summary
    ).toBe("RM");

    const nothing = { ...baseInput, description: null, readmeTextPlain: "" };
    expect(
      normalizeContent({
        base: nothing,
        config: null,
        enhancedBody: null,
        release: null,
        sanitizerVersion: "t",
      }).summary
    ).toBe("项目资料见 GitHub 仓库。");
  });

  it("增强覆盖:features/techStack 整体替换,空白 title 视为缺失,bodyFile 决定正文来源", () => {
    const config: PortfolioNormalizedConfig = {
      title: "  ",
      bodyFile: ".portfolio/overview.md",
      features: ["A", "B"],
      techStack: ["Rust"],
    };
    const content = normalizeContent({
      base: baseInput,
      config,
      enhancedBody: { html: "<p>增强</p>", textPlain: "增强" },
      release,
      sanitizerVersion: "t",
    });
    expect(content.title).toBe("aurora-theme"); // 空白不算有效覆盖
    expect(content.features).toEqual(["A", "B"]);
    expect(content.techStack).toEqual(["Rust"]);
    expect(content.bodyHtml).toBe("<p>增强</p>");

    // 增强配置省略 bodyFile:正文回退 README(计划 §5.3)
    const withoutBodyFile = normalizeContent({
      base: baseInput,
      config: { features: ["A"] },
      enhancedBody: { html: "<p>增强</p>", textPlain: "增强" },
      release: null,
      sanitizerVersion: "t",
    });
    expect(withoutBodyFile.bodyHtml).toBe("<p>README 正文</p>");
  });

  it("techStack:配置省略回退 language,[] 明确隐藏", () => {
    const omitted = normalizeContent({
      base: baseInput,
      config: {},
      enhancedBody: null,
      release: null,
      sanitizerVersion: "t",
    });
    expect(omitted.techStack).toEqual(["TypeScript"]);

    const hidden = normalizeContent({
      base: baseInput,
      config: { techStack: [] },
      enhancedBody: null,
      release: null,
      sanitizerVersion: "t",
    });
    expect(hidden.techStack).toEqual([]);
  });

  it("links.website:省略回退 homepage,null 明确隐藏", () => {
    const fallback = normalizeContent({
      base: baseInput,
      config: {},
      enhancedBody: null,
      release: null,
      sanitizerVersion: "t",
    });
    expect(fallback.links.website).toBe("https://example.com/");

    const explicitHide = normalizeContent({
      base: baseInput,
      config: { links: { website: null } },
      enhancedBody: null,
      release: null,
      sanitizerVersion: "t",
    });
    expect(explicitHide.links.website).toBeNull();
  });

  it("删除字段不从旧配置复活:cover/screenshots 为 null/[]", () => {
    const content = normalizeContent({
      base: baseInput,
      config: null,
      enhancedBody: null,
      release: null,
      sanitizerVersion: "t",
    });
    expect(content.cover ?? null).toBeNull();
    expect(content.screenshots).toEqual([]);
    expect(content.additionalDownloads).toEqual([]);
  });
});

describe("effectiveMode(计划 §5.3)", () => {
  it("absent/basic、valid/enhanced、invalid+LKG/enhanced、invalid 无 LKG/basic", () => {
    expect(effectiveMode("absent", false)).toBe("basic");
    expect(effectiveMode("valid", false)).toBe("enhanced");
    expect(effectiveMode("invalid", true)).toBe("enhanced");
    expect(effectiveMode("invalid", false)).toBe("basic");
    expect(effectiveMode("fetch_error", true)).toBe("basic");
  });
});
