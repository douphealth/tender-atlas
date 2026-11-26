import { createFileRoute } from "@tanstack/react-router";
import { cfBinding } from "@/lib/cf-env";
import { cacheApiLastGood, currentSitemap } from "@/lib/procurement/sitemap";
import type { AtlasEnv } from "@/lib/procurement/store";

export const Route = createFileRoute("/sitemap.xml")({
  server: { handlers: { GET: async () => {
    const db = cfBinding("DB") as unknown as AtlasEnv["DB"];
    const doc = await currentSitemap(db, cacheApiLastGood());
    // No trustworthy copy: say "try again later". A short sitemap here would tell crawlers the pages are gone.
    if (!doc) return new Response("Sitemap temporarily unavailable\n", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "3600", "Cache-Control": "no-store" } });
    return new Response(doc.xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Sitemap-Source": doc.from, "X-Sitemap-Urls": String(doc.urls) } });
  } } },
});
