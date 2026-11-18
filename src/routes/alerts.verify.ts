import { createFileRoute } from "@tanstack/react-router";
import { cfBinding } from "@/lib/cf-env";
import type { AtlasEnv } from "@/lib/procurement/store";
import { actionPage, tokenHash } from "@/lib/notifications";

export const Route = createFileRoute("/alerts/verify")({
  server: { handlers: { GET: async ({ request }) => {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const db = cfBinding("DB") as unknown as AtlasEnv["DB"];
    if (!db || token.length < 40 || token.length > 100) return actionPage("Link unavailable", "This confirmation link is invalid or alerts are not configured.");
    const row = await db.prepare("SELECT id FROM alert_subscriptions WHERE verify_token_hash = ?").bind(await tokenHash(token)).first<{ id: string }>();
    if (!row) return actionPage("Link not recognised", "This confirmation link is invalid or has already been replaced.");
    await db.prepare("UPDATE alert_subscriptions SET verified = 1 WHERE id = ?").bind(row.id).run();
    return actionPage("Alert confirmed", "Your daily tender alert is active. New matches will arrive by email after the next scheduled check.");
  } } },
});
