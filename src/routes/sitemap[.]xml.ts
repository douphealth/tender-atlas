import { createFileRoute } from "@tanstack/react-router";
import { COUNTRIES, CPV_DIVISIONS } from "@/lib/procurement/catalog";
import { sitemapHubRows, sitemapNoticeRows, type AtlasEnv } from "@/lib/procurement/store";
import { renderSitemap, STATIC_SITEMAP_PATHS } from "@/lib/sitemap";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const db = process.env["DB"] as unknown as AtlasEnv["DB"];
        const [notices, hubs] = await Promise.all([sitemapNoticeRows(db), sitemapHubRows(db)]);
        const noticeUrls = notices.map((n) => ({
          path: `/tenders/${n.source}/${encodeURIComponent(n.notice_id)}`,
          lastmod: n.updated_at ?? n.published_at,
        }));
        const hubUrls = hubs.flatMap((h) => {
          const country = COUNTRIES.find((c) => c.iso3 === h.country);
          return country && CPV_DIVISIONS.some((d) => d.code === h.division)
            ? [{ path: `/countries/${country.iso2}/cpv/${h.division}`, lastmod: h.lastmod }]
            : [];
        });
        const xml = renderSitemap([
          ...STATIC_SITEMAP_PATHS.map((path) => ({ path })),
          ...noticeUrls,
          ...hubUrls,
        ]);
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
