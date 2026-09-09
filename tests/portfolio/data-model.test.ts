import { describe, expect, it } from "vitest";
import settingsFile from "../../data/portfolio/settings.json";
import sourcesFile from "../../data/portfolio/sources.json";
import projectsFile from "../../data/portfolio/projects.json";
import {
  DEFAULT_DISPLAY_SETTINGS,
  normalizeDisplaySettings,
  selectVisiblePortfolioProjects,
  sortPortfolioProjects,
  validatePortfolioDataFile,
  validatePortfolioDataText,
} from "@/lib/portfolio/data-model";

describe("GitHub portfolio data files v1", () => {
  it("三个数据文件通过同一 Schema 且集合字段有效", () => {
    expect(validatePortfolioDataFile("settings", settingsFile).ok).toBe(true);
    expect(validatePortfolioDataFile("sources", sourcesFile).ok).toBe(true);
    expect(validatePortfolioDataFile("projects", projectsFile).ok).toBe(true);
    expect(Array.isArray(settingsFile.settings)).toBe(true);
    expect(Array.isArray(sourcesFile.sources)).toBe(true);
    expect(Array.isArray(projectsFile.projects)).toBe(true);
  });

  it("来源观察与公开项目遵守 v1 字段边界", () => {
    const source = {
      schemaVersion: 1,
      repoId: "1001",
      nodeId: "R_kgDOExample",
      fullName: "jesongit/example",
      eligibility: "public",
      attemptState: "success",
      observedAt: "2026-09-09T00:00:00Z",
      lastPublicVerifiedAt: "2026-09-09T00:00:00Z",
      payloadHash: null,
      configState: "absent",
      mode: "basic",
      releaseState: "none",
      lastContentSuccessAt: null,
      warnings: [],
    };
    const project = {
      slug: "gh-1001",
      title: "Example",
      summary: "A public example.",
      topics: ["example"],
      techStack: ["TypeScript"],
      features: [],
      screenshots: [],
      links: {
        github: "https://github.com/jesongit/example",
        website: null,
        demo: null,
        docs: null,
      },
      github: {
        fullName: "jesongit/example",
        url: "https://github.com/jesongit/example",
        stars: 0,
        license: null,
        language: "TypeScript",
      },
      release: null,
    };

    expect(
      validatePortfolioDataFile("sources", {
        schemaVersion: 1,
        sources: [source],
      }).ok
    ).toBe(true);
    expect(
      validatePortfolioDataFile("projects", {
        schemaVersion: 1,
        projects: [project],
      }).ok
    ).toBe(true);
    expect(
      validatePortfolioDataFile("projects", {
        schemaVersion: 1,
        projects: [{ ...project, visible: true }],
      }).ok
    ).toBe(false);
  });

  it("缺少设置时默认隐藏，featured 不会越过 visible", () => {
    expect(normalizeDisplaySettings("1001")).toEqual({
      repoId: "1001",
      ...DEFAULT_DISPLAY_SETTINGS,
    });
    expect(
      normalizeDisplaySettings("1001", {
        repoId: "1001",
        featured: true,
      }).featured
    ).toBe(false);
  });

  it("按 featured(可选)、order、数字 repoId 稳定排序", () => {
    const projects = [
      { slug: "gh-20" },
      { slug: "gh-3" },
      { slug: "gh-10" },
      { slug: "gh-99" },
    ];
    const settings = [
      { repoId: "20", visible: true, order: 10 },
      { repoId: "3", visible: true, order: 10 },
      { repoId: "10", visible: true, featured: true, order: 50 },
      { repoId: "99", visible: false, featured: true, order: 0 },
    ];

    expect(
      sortPortfolioProjects(projects, settings, { visibleOnly: false })
    ).toEqual([
      { slug: "gh-99" },
      { slug: "gh-3" },
      { slug: "gh-20" },
      { slug: "gh-10" },
    ]);
    expect(sortPortfolioProjects(projects, settings)).toEqual([
      { slug: "gh-3" },
      { slug: "gh-20" },
      { slug: "gh-10" },
    ]);
    expect(selectVisiblePortfolioProjects(projects, settings)).toEqual([
      { slug: "gh-3" },
      { slug: "gh-20" },
      { slug: "gh-10" },
    ]);
    expect(
      selectVisiblePortfolioProjects(projects, settings, {
        featuredFirst: true,
      })
    ).toEqual([{ slug: "gh-10" }, { slug: "gh-3" }, { slug: "gh-20" }]);
  });

  it("拒绝重复 ID、未知根字段和管理字段污染项目文件", () => {
    const duplicate = validatePortfolioDataFile("settings", {
      schemaVersion: 1,
      settings: [{ repoId: "1" }, { repoId: "1", order: 2 }],
    });
    expect(duplicate.ok).toBe(false);

    const unknown = validatePortfolioDataFile("projects", {
      schemaVersion: 1,
      projects: [],
      visible: true,
    });
    expect(unknown.ok).toBe(false);
  });

  it("文本校验拒绝重复 JSON 键和跨文件集合错配", () => {
    expect(
      validatePortfolioDataText(
        "settings",
        '{"schemaVersion":1,"settings":[],"settings":[]}'
      ).ok
    ).toBe(false);
    expect(
      validatePortfolioDataText("settings", '{"schemaVersion":1,"projects":[]}')
        .ok
    ).toBe(false);
  });
});
