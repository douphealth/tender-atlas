import { createFileRoute } from "@tanstack/react-router";
import type { AtlasEnv } from "@/lib/procurement/store";

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: { handlers: { POST: async ({ request }) => {
    const secret = process.env["STRIPE_WEBHOOK_SECRET"];
    const db = process.env["DB"] as unknown as AtlasEnv["DB"];
    const signature = request.headers.get("stripe-signature") ?? "";
    if (!secret || !db || !signature) return new Response("Webhook not configured", { status: 503 });
    const parts = Object.fromEntries(signature.split(",").map((part) => part.split("=", 2) as [string, string]));
    const timestamp = Number(parts["t"]); const provided = parts["v1"] ?? "";
    if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300 || !/^[a-f0-9]{64}$/.test(provided)) return new Response("Invalid signature", { status: 401 });
    const raw = await request.text();
    const expected = await hmac(`${timestamp}.${raw}`, secret);
    if (!equal(expected, provided)) return new Response("Invalid signature", { status: 401 });
    let event: { id?: string; type?: string; data?: { object?: { metadata?: { requestId?: string } } } };
    try { event = JSON.parse(raw); } catch { return new Response("Invalid JSON", { status: 400 }); }
    if (!event.id || !event.type) return new Response("Invalid event", { status: 400 });
    const existing = await db.prepare("SELECT event_id FROM stripe_events WHERE event_id = ?").bind(event.id).first();
    if (existing) return Response.json({ received: true });
    const statements = [db.prepare("INSERT INTO stripe_events (event_id, event_type, received_at) VALUES (?, ?, ?)").bind(event.id, event.type, new Date().toISOString())];
    const requestId = event.data?.object?.metadata?.requestId;
    if (event.type === "checkout.session.completed" && requestId) statements.push(db.prepare("UPDATE dossier_requests SET payment_status = 'paid', status = 'paid-queue' WHERE id = ?").bind(requestId));
    await db.batch(statements);
    return Response.json({ received: true });
  } } },
});
