import { describe, expect, it } from "vitest";
import {
  parseJsonRejectingDuplicateKeys,
  validatePortfolioConfigText,
} from "@/lib/portfolio/validate";

const base = JSON.stringify({ schemaVersion: 1 });

describe("validatePortfolioConfigText", () => {
  it("仅 schemaVersion 的最小配置合法(计划 §5.1)", () => {
    const result = validatePortfolioConfigText(base);
    expect(result.ok).toBe(true);
  });

  it("缺少 schemaVersion 拒绝", () => {
    const result = validatePortfolioConfigText("{}");
    expect(result.ok).toBe(false);
  });

  it("拒绝非对象配置", () => {
    expect(validatePortfolioConfigText("[]").ok).toBe(false);
    expect(validatePortfolioConfigText("null").ok).toBe(false);
    expect(validatePortfolioConfigText('"x"').ok).toBe(false);
  });

  it("管理字段与未知字段使整个配置失败(计划 §5.3)", () => {
    for (const key of ["visible", "featured", "order", "slug", "status"]) {
      const result = validatePortfolioConfigText(
        JSON.stringify({ schemaVersion: 1, [key]: true })
      );
      expect(result.ok).toBe(false);
    }
    const nested = validatePortfolioConfigText(
      JSON.stringify({
        schemaVersion: 1,
        links: { website: null, widget: 1 },
      })
    );
    expect(nested.ok).toBe(false);
  });

  it("禁止非 HTTPS 地址与凭据", () => {
    const http = validatePortfolioConfigText(
      JSON.stringify({ schemaVersion: 1, links: { website: "http://a.com" } })
    );
    expect(http.ok).toBe(false);

    const cred = validatePortfolioConfigText(
      JSON.stringify({
        schemaVersion: 1,
        links: { website: "https://user:pass@a.com" },
      })
    );
    expect(cred.ok).toBe(false);
  });

  it("拒绝回环/私网地址(计划 §5.2 语义补充)", () => {
    for (const url of [
      "https://localhost/x",
      "https://127.0.0.1/x",
      "https://10.0.0.2/x",
      "https://192.168.1.1/x",
      "https://172.16.0.1/x",
      "https://192.0.2.5:443/", // 公网测试地址应通过
    ]) {
      const result = validatePortfolioConfigText(
        JSON.stringify({ schemaVersion: 1, links: { website: url } })
      );
      if (url.startsWith("https://192.0.2.5")) {
        expect(result.ok).toBe(true);
      } else {
        expect(result.ok).toBe(false);
      }
    }
  });

  it("路径穿越、反斜线与百分号编码拒绝", () => {
    const cases = [
      ".portfolio/../evil.md",
      ".portfolio/assets\\x.md",
      ".portfolio/assets/%6d.md",
    ];
    for (const bodyFile of cases) {
      const result = validatePortfolioConfigText(
        JSON.stringify({ schemaVersion: 1, bodyFile })
      );
      expect(result.ok).toBe(false);
    }
  });

  it("width/height 必须成对", () => {
    const half = validatePortfolioConfigText(
      JSON.stringify({
        schemaVersion: 1,
        cover: { path: ".portfolio/assets/a.webp", alt: "a", width: 100 },
      })
    );
    expect(half.ok).toBe(false);

    const paired = validatePortfolioConfigText(
      JSON.stringify({
        schemaVersion: 1,
        cover: {
          path: ".portfolio/assets/a.webp",
          alt: "a",
          width: 100,
          height: 50,
        },
      })
    );
    expect(paired.ok).toBe(true);
  });

  it("重复 JSON 键拒绝", () => {
    const result = validatePortfolioConfigText(
      '{"schemaVersion":1,"title":"a","title":"b"}'
    );
    expect(result.ok).toBe(false);

    const nestedDup = validatePortfolioConfigText(
      '{"schemaVersion":1,"links":{"demo":null,"demo":null}}'
    );
    expect(nestedDup.ok).toBe(false);
  });

  it("超过 32KiB 拒绝", () => {
    const big = JSON.stringify({
      schemaVersion: 1,
      features: ["x".repeat(120)],
    });
    const padded = `{"schemaVersion":1,"summary":"${"长".repeat(200)}","features":[]}`;
    expect(validatePortfolioConfigText(padded).ok).toBe(true);
    void big;
    const huge = `{"schemaVersion":1,"summary":"${"长".repeat(20000)}"}`;
    expect(validatePortfolioConfigText(huge).ok).toBe(false);
  });

  it("parseJsonRejectingDuplicateKeys 直接可用", () => {
    expect(parseJsonRejectingDuplicateKeys('{"a":1,"a":2}').ok).toBe(false);
    expect(parseJsonRejectingDuplicateKeys('{"a":1,"b":{"a":2}}').ok).toBe(
      true
    );
  });
});
