import { expect, test } from "@playwright/test";

/**
 * 烟囱验收(计划 §17 博客回归 / 安全 / 门禁):
 * 不依赖真实 KV 的路径:静态文章回归、规范 API 公开可读、
 * 管理路径未鉴权拒绝、作品页空状态可读。
 */
test.describe("静态博客回归", () => {
  test("既有文章 URL 保留且可读", async ({ request }) => {
    const response = await request.get("/posts/notes/git-cheatsheet/");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("data-pagefind-body");
  });

  test("文章分页、标签、归档、关于页和搜索壳保持可用", async ({ request }) => {
    for (const path of [
      "/posts/",
      "/posts/2/",
      "/tags/教程/",
      "/archives/",
      "/about/",
      "/search/",
      "/pagefind/pagefind.js",
      "/sitemap-index.xml",
    ]) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
  });

  test("文章 OG 图片仍由静态产物提供", async ({ request }) => {
    const response = await request.get("/posts/notes/git-cheatsheet/index.png");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  });

  test("RSS 与 robots 可用且声明作品 sitemap", async ({ request }) => {
    expect((await request.get("/rss.xml")).status()).toBe(200);
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Sitemap:");
    expect(robots).toContain("/sitemap-projects.xml");
    expect(robots).toContain("Disallow: /api/admin");
  });

  test("404 是真实 404", async ({ request }) => {
    expect((await request.get("/no-such-page/")).status()).toBe(404);
  });
});

test.describe("公开规范 API(无需身份)", () => {
  test("spec.json / schema / prompt 可读且带缓存头", async ({ request }) => {
    const spec = await request.get("/api/portfolio/spec.json");
    expect(spec.status()).toBe(200);
    expect((await spec.json()).currentVersion).toBe(1);

    const schema = await request.get("/api/portfolio/schema/v1.json");
    expect(schema.status()).toBe(200);
    expect((await schema.json()).$id).toContain(
      "/api/portfolio/schema/v1.json"
    );

    const prompt = await request.get("/api/portfolio/prompt.txt");
    expect(prompt.status()).toBe(200);
    expect(await prompt.text()).toContain(".portfolio/portfolio.json");
  });
});

test.describe("管理路径失败关闭", () => {
  test("未鉴权访问 /admin 与 /api/admin 被拒", async ({ request }) => {
    expect([401, 403, 503]).toContain((await request.get("/admin/")).status());
    expect([401, 403, 503]).toContain(
      (await request.get("/api/admin/session")).status()
    );
  });
});

test.describe("作品页空状态", () => {
  test("作品列表 200 且有可读空状态(SSR 正文)", async ({ request }) => {
    const response = await request.get("/projects/");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("全部作品");
  });

  test("不存在的作品详情为真实 404", async ({ request }) => {
    expect((await request.get("/projects/gh-999999/")).status()).toBe(404);
    expect((await request.get("/projects/not-a-slug/")).status()).toBe(404);
  });
});
