// Separate entry for Cloudflare scheduled events; no browser module imports this file.
import type { AtlasEnv } from "./procurement/store";

export async function ingestIncremental(env: AtlasEnv) {
  const { ingestIncremental: ingest } = await import("./procurement/store");
  const environment: AtlasEnv = { ...env, DB: env.DB ?? (process.env["DB"] as unknown as AtlasEnv["DB"]), SAM_GOV_API_KEY: env.SAM_GOV_API_KEY ?? process.env["SAM_GOV_API_KEY"] };
  return ingest(environment);
}

export async function sendDueAlerts(env: AtlasEnv) {
  const { sendDueAlerts: send } = await import("./notifications");
  const environment: AtlasEnv = { ...env, DB: env.DB ?? (process.env["DB"] as unknown as AtlasEnv["DB"]), RESEND_API_KEY: env.RESEND_API_KEY ?? process.env["RESEND_API_KEY"], NOTIFICATION_FROM_EMAIL: env.NOTIFICATION_FROM_EMAIL ?? process.env["NOTIFICATION_FROM_EMAIL"] };
  return send(environment);
}
