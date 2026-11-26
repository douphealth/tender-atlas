import { createFileRoute } from "@tanstack/react-router";
import { cfBinding } from "@/lib/cf-env";
import { parseSearch } from "@/lib/procurement/sources";
import { sharedCached } from "@/lib/procurement/cache";
import { searchWithStore, type AtlasEnv } from "@/lib/procurement/store";

// Read-only public procurement data; no credentials or private records are returned.
export const Route = createFileRoute("/api/search")({
  server: { handlers: { GET: async ({ request }) => {
    const p = parseSearch(Object.fromEntries(new URL(request.url).searchParams));
    const env: AtlasEnv = { DB: cfBinding("DB") as unknown as AtlasEnv["DB"], SAM_GOV_API_KEY: process.env["SAM_GOV_API_KEY"] };
    // Same key as the searchTenders server function, so the API and the pages share one cached result.
    const d = await sharedCached(`s:${JSON.stringify(p)}:`, 10 * 60, () => searchWithStore(p, env));
    return Response.json({ ...d, notices: d.items }, { headers: { "Cache-Control": "public, max-age=180", "Access-Control-Allow-Origin": "*" } });
  } } },
});
