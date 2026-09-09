import { describe, expect, it } from "vitest";
import {
  renderMarkdown,
  summarizePlainText,
  truncateChars,
} from "@/lib/portfolio/markdown";

describe("renderMarkdown 安全清洗(计划 §7.3)", () => {
  it("raw HTML 整体丢弃(计划 §7.3:禁止 raw HTML)", async () => {
    const { html, textPlain } = await renderMarkdown(
      '<p>ok</p><script>alert(1)</script><iframe src="https://evil"></iframe>'
    );
    expect(html).not.toContain("script");
    expect(html).not.toContain("iframe");
    expect(html).not.toContain("alert");
    // raw HTML 块不入正文,真实内容必须用 Markdown 语法表达
    expect(textPlain).toBe("");

    const kept = await renderMarkdown("正常 **文本**");
    expect(kept.html).toContain("正常");
    expect(kept.html).toContain("<strong>文本</strong>");
  });

  it("javascript: 链接被清洗", async () => {
    const { html } = await renderMarkdown("[x](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("相对图片按调用方解析为同 commit raw 地址,仅允许 https", async () => {
    const { html } = await renderMarkdown("![a](docs/img.png)", {
      resolveUrl: (url, isImage) =>
        isImage
          ? `https://raw.githubusercontent.com/owner/repo/SHA/docs/img.png`
          : url,
    });
    expect(html).toContain(
      "raw.githubusercontent.com/owner/repo/SHA/docs/img.png"
    );
  });

  it("事件属性与危险协议被剥离(经 Markdown 语法注入)", async () => {
    const { html } = await renderMarkdown(
      "[点我](javascript:alert(1)) ![x](https://a.com/x.png)"
    );
    // javascript: 链接被清洗为无 href 的占位链接
    expect(html).not.toContain("javascript:");
    expect(html).toContain("点我");
    expect(html).toContain('<img src="https://a.com/x.png"');
    expect(html).not.toContain("<script");
  });

  it("文本摘要去标签并按 Unicode 字符截断", async () => {
    const { textPlain } = await renderMarkdown("# 标题\n\n第一段\n\n第二段");
    expect(textPlain).toContain("标题");
    expect(textPlain).toContain("第二段");

    expect(truncateChars("一二三四五", 3)).toBe("一二三…");
    expect(truncateChars("abc", 5)).toBe("abc");
  });

  it("summarizePlainText 去除徽章图片与链接语法", () => {
    const md = [
      "![badge](https://img.shields.io/badge/x-y)",
      "[文档](https://a.com) 是一个测试项目,**很棒**。",
    ].join("\n");
    const summary = summarizePlainText(md);
    expect(summary).not.toContain("shields.io");
    expect(summary).not.toContain("](http");
    expect(summary).toContain("文档");
    expect(summary).toContain("很棒");
  });
});
