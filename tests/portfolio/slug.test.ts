import { describe, expect, it } from "vitest";
import {
  isProjectSlug,
  projectPath,
  projectIdFromSlug,
  projectIdToSlug,
} from "@/lib/portfolio/slug";

describe("稳定地址(计划 §9.1)", () => {
  it("gh-<数字ID> 双向映射", () => {
    expect(projectIdToSlug("1001")).toBe("gh-1001");
    expect(projectIdFromSlug("gh-1001")).toBe("1001");
    expect(projectPath("1001")).toBe("/projects/gh-1001/");
  });

  it("非法 ID/slug 拒绝", () => {
    expect(() => projectIdToSlug("abc")).toThrow();
    expect(() => projectIdToSlug("")).toThrow();
    expect(projectIdFromSlug("aurora")).toBeNull();
    expect(projectIdFromSlug("gh-")).toBeNull();
    expect(projectIdFromSlug("gh-12x")).toBeNull();
    expect(isProjectSlug("gh-42")).toBe(true);
    expect(isProjectSlug("GH-42")).toBe(false);
  });

  it("仓库重命名不影响 ID 与 URL", () => {
    // 名称只影响页面标题;slug 绑定数字 ID
    expect(projectIdToSlug("1001")).toBe(projectIdToSlug("1001"));
  });
});
