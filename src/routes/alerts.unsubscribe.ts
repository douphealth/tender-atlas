import { createFileRoute } from "@tanstack/react-router";
import type { AtlasEnv } from "@/lib/procurement/store";
import { actionPage } from "@/lib/notifications";

export const Route = createFileRoute("/alerts/unsubscribe")({
  server: { handlers: { GET: async ({ request }) => {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    const db = process.env["DB"] as unknown as AtlasEnv["DB"];
    if (!db || token.length < 40 || token.length > 100) return actionPage("Link unavailable", "This unsubscribe link is invalid.");
    const row = await db.prepare("SELECT id FROM alert_subscriptions WHERE unsubscribe_token = ?").bind(token).first<{ id: string }>();
    if (row) await db.batch([db.prepare("DELETE FROM alert_deliveries WHERE subscription_id = ?").bind(row.id), db.prepare("DELETE FROM alert_subscriptions WHERE id = ?").bind(row.id)]);
    return actionPage("Alert removed", "This email alert has been removed. No further digest will be sent for it.");
  } } },
});
