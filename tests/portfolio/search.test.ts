import { describe, expect, it } from "vitest";
import { searchProjects, type SearchRecord } from "@/lib/portfolio/search";

const record = (
  over: Partial<SearchRecord> & { slug: string }
): SearchRecord => ({
  href: `/projects/${over.slug}/`,
  title: over.slug,
  summary: "",
  topics: [],
  techStack: [],
  bodyText: "",
  order: 100,
  ...over,
});

const records: SearchRecord[] = [
  record({
    slug: "aurora",
    title: "Aurora 博客主题",
    order: 20,
    topics: ["astro"],
  }),
  record({
    slug: "gallery",
    title: "拾光相册",
    order: 10,
    topics: ["go"],
    bodyText: "支持 ASTRO 风格滤镜",
  }),
  record({
    slug: "meme",
    title: "梗图抽屉",
    order: 30,
    summary: "收藏 ASTRO 相关梗图",
  }),
];

describe("searchProjects(计划 §12.2)", () => {
  it("中文 NFKC 与大小写折叠", () => {
    const results = searchProjects(records, "ａｕｒｏｒａ"); // 全角
    expect(results[0]?.slug).toBe("aurora");
  });

  it("排序:标题精确 > 前缀 > 标签 > 摘要 > 正文", () => {
    const results = searchProjects(records, "astro");
    expect(results.map(r => r.slug)).toEqual(["aurora", "meme", "gallery"]);
  });

  it("同分按人工 order 排列", () => {
    const pool = [
      record({ slug: "b", title: "待办 B", order: 20 }),
      record({ slug: "a", title: "待办 A", order: 10 }),
    ];
    const results = searchProjects(pool, "待办");
    expect(results.map(r => r.slug)).toEqual(["a", "b"]);
  });

  it("查询长度 2–80,越界返回空", () => {
    expect(searchProjects(records, "a")).toHaveLength(0);
    expect(searchProjects(records, "")).toHaveLength(0);
    expect(searchProjects(records, "x".repeat(81))).toHaveLength(0);
    expect(searchProjects(records, "au").length).toBeGreaterThan(0);
  });

  it("最多 20 项", () => {
    const pool = Array.from({ length: 30 }, (_, i) =>
      record({ slug: `p${i}`, title: `项目${i}` })
    );
    expect(searchProjects(pool, "项目")).toHaveLength(20);
  });

  it("无命中返回空数组", () => {
    expect(searchProjects(records, "不存在的关键词组合")).toHaveLength(0);
  });
});
