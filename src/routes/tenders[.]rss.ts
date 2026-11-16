import { createFileRoute } from "@tanstack/react-router";
import { parseSearch } from "@/lib/procurement/sources";
import { searchWithStore, type AtlasEnv } from "@/lib/procurement/store";
import { abs } from "@/lib/site";
import { escapeHtml } from "@/lib/notifications";

export const Route = createFileRoute("/tenders.rss")({
  server: { handlers: { GET: async ({ request }) => {
    const url = new URL(request.url);
    const params = parseSearch(Object.fromEntries(url.searchParams));
    const env: AtlasEnv = { DB: process.env["DB"] as unknown as AtlasEnv["DB"], SAM_GOV_API_KEY: process.env["SAM_GOV_API_KEY"] };
    const result = await searchWithStore(params, env);
    const items = result.items.map((n) => {
      const link = abs(`/tenders/${n.source}/${encodeURIComponent(n.noticeId)}`);
      return `<item><title>${escapeHtml(n.title)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><pubDate>${new Date(`${n.publishedAt ?? result.fetchedAt.slice(0, 10)}T00:00:00Z`).toUTCString()}</pubDate><description>${escapeHtml(`${n.buyer ?? "Buyer not disclosed"}${n.deadlineAt ? ` · Deadline ${n.deadlineAt}` : ""} · Official ${n.provenance}`)}</description></item>`;
    }).join("\n");
    const self = abs(`/tenders.rss${url.search}`);
    const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>TenderAtlas — ${escapeHtml(params.q || "Public tenders")}</title><link>${abs(`/tenders${url.search}`)}</link><description>Official public procurement notices matching this TenderAtlas search.</description><lastBuildDate>${new Date(result.fetchedAt).toUTCString()}</lastBuildDate><atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${self}" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
    return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
  } } },
});
