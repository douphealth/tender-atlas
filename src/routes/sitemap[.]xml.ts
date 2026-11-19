import { createFileRoute } from "@tanstack/react-router";
import { cfBinding } from "@/lib/cf-env";
import { COUNTRIES, CPV_DIVISIONS } from "@/lib/procurement/catalog";
import { sitemapHubRows, sitemapListingCoverage, sitemapNoticeRows, type AtlasEnv } from "@/lib/procurement/store";
import { abs } from "@/lib/site";

const xmlEscape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

export const Route = createFileRoute("/sitemap.xml")({
  server: { handlers: { GET: async () => {
    const db = cfBinding("DB") as unknown as AtlasEnv["DB"];
    const [notices, hubs, coverage] = await Promise.all([sitemapNoticeRows(db), sitemapHubRows(db), sitemapListingCoverage(db)]);
    // Only list country and CPV pages that clear their own noindex threshold (5+ notices in 30 days).
    const paths = ["/", "/tenders", "/countries", "/cpv", "/buyers", "/alerts", "/methodology", "/pricing", "/privacy",
      ...COUNTRIES.filter((c) => !coverage || coverage.countries.has(c.iso3)).map((c) => `/countries/${c.iso2}/tenders`),
      ...CPV_DIVISIONS.filter((d) => !coverage || coverage.divisions.has(d.code)).map((d) => `/cpv/${d.code}`)];
    const noticeUrls = notices.map((n) => ({ path: `/tenders/${n.source}/${encodeURIComponent(n.notice_id)}`, lastmod: n.updated_at ?? n.published_at }));
    const hubUrls = hubs.flatMap((h) => {
      const country = COUNTRIES.find((c) => c.iso3 === h.country);
      return country && CPV_DIVISIONS.some((d) => d.code === h.division) ? [{ path: `/countries/${country.iso2}/cpv/${h.division}`, lastmod: h.lastmod }] : [];
    });
    const staticXml = paths.map((path) => `  <url><loc>${xmlEscape(abs(path))}</loc></url>`).join("\n");
    const dynamicXml = [...noticeUrls, ...hubUrls].map((entry) => `  <url><loc>${xmlEscape(abs(entry.path))}</loc>${entry.lastmod && /^\d{4}-\d{2}-\d{2}$/.test(entry.lastmod) ? `<lastmod>${entry.lastmod}</lastmod>` : ""}</url>`).join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${staticXml}${dynamicXml ? `\n${dynamicXml}` : ""}\n</urlset>\n`;
    return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
  } } },
});
