import { createFileRoute } from "@tanstack/react-router";
import { SOURCES } from "@/lib/procurement/catalog";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => Response.json({ ok: true, version: "11.0.0", at: new Date().toISOString(), sources: SOURCES, samKeyConfigured: Boolean(process.env["SAM_GOV_API_KEY"]) }, { headers: { "Cache-Control": "no-store" } }),
    },
  },
});
