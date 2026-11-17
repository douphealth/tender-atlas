import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { llmsTxt } from "./llms";
import { fitDescription, fitTitle, pageHead } from "./seo";
import { renderSitemap, sitemapLastmod, STATIC_SITEMAP_PATHS } from "./sitemap";
import { DEFAULT_SITE_URL, SITE_URL, abs } from "./site";

describe("public origin", () => {
  it("defaults to the production shop origin", () => {
    expect(DEFAULT_SITE_URL).toBe("https://tenderatlas.shop");
    expect(SITE_URL.startsWith("https://")).toBe(true);
    expect(SITE_URL).not.toContain("pages.dev");
  });

  it("builds absolute URLs from SITE_URL", () => {
    expect(abs("/sitemap.xml")).toBe(`${SITE_URL}/sitemap.xml`);
    expect(abs("/")).toBe(`${SITE_URL}/`);
    expect(abs("tenders")).toBe(`${SITE_URL}/tenders`);
  });
});

describe("pageHead", () => {
  it("emits a production canonical, index robots, social tags and JSON-LD", () => {
    const head = pageHead({
      title: "Search public tenders",
      description: "Search open public procurement notices.",
      path: "/tenders",
      jsonLd: { "@context": "https://schema.org", "@type": "WebSite", url: abs("/") },
    });
    expect(head.links).toEqual([{ rel: "canonical", href: `${SITE_URL}/tenders` }]);
    expect(
      head.meta.find((entry) => "property" in entry && entry.property === "og:url"),
    ).toMatchObject({ content: `${SITE_URL}/tenders` });
    expect(head.meta.find((entry) => "name" in entry && entry.name === "robots")).toMatchObject({
      content: "index, follow",
    });
    expect(
      head.meta.find((entry) => "property" in entry && entry.property === "og:image"),
    ).toMatchObject({ content: `${SITE_URL}/og.png` });
    expect(
      head.meta.find((entry) => "name" in entry && entry.name === "twitter:card"),
    ).toMatchObject({ content: "summary_large_image" });
    const title = head.meta.find((entry) => "title" in entry && entry.title)?.title ?? "";
    const description =
      head.meta.find((entry) => "name" in entry && entry.name === "description")?.content ?? "";
    expect(title.length).toBeLessThanOrEqual(60);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(title).toContain("TenderAtlas");
    const raw = head.scripts[0]?.children ?? "";
    expect(JSON.parse(raw)).toMatchObject({ url: SITE_URL + "/" });
    expect(raw).not.toContain("pages.dev");
  });

  it("noindexes filtered and utility pages without dropping the clean canonical", () => {
    const head = pageHead({
      title: "Search public tenders",
      description: "Filtered tender search.",
      path: "/tenders",
      noindex: true,
    });
    expect(head.meta.find((entry) => "name" in entry && entry.name === "robots")).toMatchObject({
      content: "noindex, follow",
    });
    expect(head.links[0]).toEqual({ rel: "canonical", href: `${SITE_URL}/tenders` });
  });

  it("caps long titles and descriptions", () => {
    const title = fitTitle(
      "Architectural, construction, engineering and inspection services tenders in the United Kingdom",
    );
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("TenderAtlas")).toBe(true);
    const description = fitDescription(`${"word ".repeat(50)}end`);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith("…")).toBe(true);
  });
});

describe("sitemap and crawler files", () => {
  it("lists the directory on the production origin and keeps real lastmod dates", () => {
    expect(STATIC_SITEMAP_PATHS).toHaveLength(86);
    const xml = renderSitemap([
      ...STATIC_SITEMAP_PATHS.map((path) => ({ path })),
      { path: "/tenders/ted/123-2026", lastmod: "2026-11-02T18:00:00Z" },
      { path: "/tenders/uk/bad", lastmod: "not-a-date" },
    ]);
    expect(xml.startsWith("<?xml")).toBe(true);
    expect(xml).toContain(`<loc>${SITE_URL}/</loc>`);
    expect(xml).toContain(
      `<loc>${SITE_URL}/tenders/ted/123-2026</loc><lastmod>2026-11-02</lastmod>`,
    );
    expect(xml).not.toContain("not-a-date");
    expect(xml).not.toContain("pages.dev");
    expect(sitemapLastmod("2026-02-31")).toBeNull();
    expect(sitemapLastmod("2026-11-02")).toBe("2026-11-02");
  });

  it("points robots.txt at the production sitemap and allows answer-engine crawlers", () => {
    const robots = readFileSync(path.resolve("public/robots.txt"), "utf8");
    expect(robots).toContain("Sitemap: https://tenderatlas.shop/sitemap.xml");
    expect(robots).not.toContain("pages.dev");
    for (const bot of [
      "Googlebot",
      "Bingbot",
      "GPTBot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "PerplexityBot",
      "ClaudeBot",
      "Google-Extended",
      "Applebot-Extended",
    ]) {
      expect(robots).toContain(`User-agent: ${bot}`);
    }
    expect(robots).toContain("Disallow: /api/");
    expect(robots).toContain("Disallow: /app");
  });

  it("writes llms.txt with production links", () => {
    const text = llmsTxt();
    expect(text).toContain("# TenderAtlas");
    expect(text).toContain(`${SITE_URL}/methodology`);
    expect(text).toContain(`${SITE_URL}/sitemap.xml`);
    expect(text).not.toContain("pages.dev");
  });

  it("publishes the IndexNow key file", () => {
    const key = "6541e36054ab20cf0850f67f4db053df";
    const body = readFileSync(path.resolve(`public/${key}.txt`), "utf8").trim();
    expect(body).toBe(key);
  });

  it("ships a branded PNG share image", () => {
    const bytes = readFileSync(path.resolve("public/og.png"));
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
