import { createFileRoute } from "@tanstack/react-router";
import { parseSearch } from "@/lib/procurement/sources";
import { cached } from "@/lib/procurement/cache";
import { searchWithStore, type AtlasEnv } from "@/lib/procurement/store";

// Read-only public procurement data; no credentials or private records are returned.
export const Route = createFileRoute("/api/search")({
  server: { handlers: { GET: async ({ request }) => {
    const p = parseSearch(Object.fromEntries(new URL(request.url).searchParams));
    const env: AtlasEnv = { DB: process.env["DB"] as unknown as AtlasEnv["DB"], SAM_GOV_API_KEY: process.env["SAM_GOV_API_KEY"] };
    const d = await cached(`api:${JSON.stringify(p)}`, 5 * 60_000, () => searchWithStore(p, env));
    return Response.json({ ...d, notices: d.items }, { headers: { "Cache-Control": "public, max-age=180", "Access-Control-Allow-Origin": "*" } });
  } } },
});
