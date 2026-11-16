import { createFileRoute } from "@tanstack/react-router";
import { COUNTRIES, CPV_DIVISIONS } from "@/lib/procurement/catalog";
import { abs } from "@/lib/site";

// Only stable directory pages are listed. Individual notices are discovered through internal links.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const paths = ["/", "/tenders", "/countries", "/cpv", "/methodology", "/pricing", "/privacy",
          ...COUNTRIES.map((c) => `/countries/${c.iso2}/tenders`), ...CPV_DIVISIONS.map((d) => `/cpv/${d.code}`)];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `  <url><loc>${abs(p)}</loc></url>`).join("\n")}\n</urlset>\n`;
        return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
