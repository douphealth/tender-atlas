import { createFileRoute } from "@tanstack/react-router";
import { collect, parseSearch } from "@/lib/procurement/sources";
import { cached } from "@/lib/procurement/cache";

// Public JSON API kept compatible with the previous /api/search endpoint. Read-only public data.
export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const p = parseSearch(Object.fromEntries(new URL(request.url).searchParams));
        const d = await cached(`api:${JSON.stringify(p)}`, 5 * 60_000, () => collect(p, { SAM_GOV_API_KEY: process.env["SAM_GOV_API_KEY"] }));
        return Response.json({ ...d, notices: d.items }, { headers: { "Cache-Control": "public, max-age=180", "Access-Control-Allow-Origin": "*" } });
      },
    },
  },
});
