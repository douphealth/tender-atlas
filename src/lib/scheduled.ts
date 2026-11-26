import { cfBinding } from "@/lib/cf-env";
// Separate entry for Cloudflare scheduled events; no browser module imports this file.
import type { AtlasEnv } from "./procurement/store";

export async function ingestIncremental(env: AtlasEnv) {
  const { ingestIncremental: ingest } = await import("./procurement/store");
  const environment: AtlasEnv = { ...env, DB: env.DB ?? (cfBinding("DB") as unknown as AtlasEnv["DB"]), SAM_GOV_API_KEY: env.SAM_GOV_API_KEY ?? process.env["SAM_GOV_API_KEY"] };
  return ingest(environment);
}

/** Rebuilds the stored sitemap after an ingest. Reports instead of throwing: the ingest itself succeeded. */
export async function refreshSitemap(env: AtlasEnv): Promise<{ urls: number } | { error: string }> {
  const db = env.DB ?? (cfBinding("DB") as unknown as AtlasEnv["DB"]);
  if (!db) return { error: "Cloudflare D1 is not configured" };
  try {
    const { rebuildSitemap } = await import("./procurement/sitemap");
    return { urls: (await rebuildSitemap(db)).urls };
  } catch (error) {
    console.error("Sitemap rebuild after ingest failed", error);
    return { error: error instanceof Error ? error.message.slice(0, 120) : "Sitemap rebuild failed" };
  }
}

export async function sendDueAlerts(env: AtlasEnv) {
  const { sendDueAlerts: send } = await import("./notifications");
  const environment: AtlasEnv = { ...env, DB: env.DB ?? (cfBinding("DB") as unknown as AtlasEnv["DB"]), RESEND_API_KEY: env.RESEND_API_KEY ?? process.env["RESEND_API_KEY"], NOTIFICATION_FROM_EMAIL: env.NOTIFICATION_FROM_EMAIL ?? process.env["NOTIFICATION_FROM_EMAIL"] };
  return send(environment);
}
