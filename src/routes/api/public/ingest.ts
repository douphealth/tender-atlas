import { createFileRoute } from "@tanstack/react-router";
import { cfBinding } from "@/lib/cf-env";
import { ingestIncremental, type AtlasEnv } from "@/lib/procurement/store";

export const Route = createFileRoute("/api/public/ingest")({
  server: { handlers: { POST: async ({ request }) => {
    const secret = process.env["CRON_SECRET"];
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
    const env: AtlasEnv = { DB: cfBinding("DB") as unknown as AtlasEnv["DB"], SAM_GOV_API_KEY: process.env["SAM_GOV_API_KEY"] };
    try { return Response.json(await ingestIncremental(env), { headers: { "Cache-Control": "no-store" } }); }
    catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Ingestion failed" }, { status: 503 }); }
  } } },
});
