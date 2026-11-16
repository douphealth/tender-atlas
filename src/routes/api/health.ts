import { createFileRoute } from "@tanstack/react-router";
import { SOURCES } from "@/lib/procurement/catalog";

export const Route = createFileRoute("/api/health")({
  server: { handlers: { GET: async () => {
    let database = "not-configured";
    const db = process.env["DB"] as unknown as { prepare(sql: string): { first(): Promise<unknown> } } | undefined;
    if (db) { try { await db.prepare("SELECT 1").first(); database = "connected"; } catch { database = "error"; } }
    return Response.json({ ok: true, version: "12.0.0", at: new Date().toISOString(), sources: SOURCES, database, samKeyConfigured: Boolean(process.env["SAM_GOV_API_KEY"]), alertsConfigured: Boolean(process.env["RESEND_API_KEY"] && process.env["TURNSTILE_SECRET_KEY"]), checkoutConfigured: Boolean(process.env["STRIPE_SECRET_KEY"] && process.env["STRIPE_PRICE_ID"]) }, { headers: { "Cache-Control": "no-store" } });
  } } },
});
