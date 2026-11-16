import type { AtlasEnv } from "../procurement/store";
import { emailLayout, escapeHtml, sendEmail } from "../notifications";

export async function verifyStripeSignature(raw: string, signature: string, secret: string, now = Date.now()): Promise<boolean> {
  const parts = signature.split(",").map((p) => p.trim().split("=", 2));
  const timestamp = parts.find(([k]) => k === "t")?.[1];
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${raw}`));
  const expected = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return parts.filter(([k]) => k === "v1").some(([, provided]) => {
    if (!provided || !/^[a-f0-9]{64}$/.test(provided)) return false;
    let diff = 0;
    for (let i = 0; i < 64; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
    return diff === 0;
  });
}
export function paidSessionMatches(session: { id?: string; mode?: string; payment_status?: string; amount_subtotal?: number; currency?: string; metadata?: { requestId?: string; offerVersion?: string } }, order: { id: string; stripe_session_id: string; offer_version: string; expected_amount: number; currency: string }): boolean {
  return session.id === order.stripe_session_id && session.mode === "payment" && session.payment_status === "paid" && session.amount_subtotal === order.expected_amount && session.currency === order.currency && session.metadata?.requestId === order.id && session.metadata?.offerVersion === order.offer_version;
}
export async function handleDossierWebhook(request: Request, env: AtlasEnv): Promise<Response> {
  const db = env.DB; const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!db || !secret) return new Response("Webhook unavailable", { status: 503 });
  const raw = await request.text();
  if (!await verifyStripeSignature(raw, request.headers.get("stripe-signature") ?? "", secret)) return new Response("Invalid signature", { status: 401 });
  let event: { id?: string; type?: string; data?: { object?: { id?: string; mode?: string; payment_status?: string; amount_subtotal?: number; currency?: string; metadata?: { requestId?: string; offerVersion?: string } } } };
  try { event = JSON.parse(raw); } catch { return new Response("Invalid event", { status: 400 }); }
  if (!event.id || !event.type) return new Response("Invalid event", { status: 400 });
  const session = event.data?.object;
  const paidEvent = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded";
  if (!paidEvent || session?.payment_status !== "paid") return Response.json({ received: true });
  const order = await db.prepare("SELECT * FROM dossier_orders WHERE id = ?").bind(session.metadata?.requestId ?? "").first<{ id: string; stripe_session_id: string; offer_version: string; expected_amount: number; currency: string; focus: string; notice_snapshot: string; owner_notified_at: string | null }>();
  if (!order || !paidSessionMatches(session, order)) return new Response("Order mismatch", { status: 409 });
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO stripe_events (event_id, event_type, received_at) VALUES (?, ?, ?)").bind(event.id, event.type, now),
    db.prepare("UPDATE dossier_orders SET payment_status = 'paid', paid_at = COALESCE(paid_at, ?) WHERE id = ?").bind(now, order.id),
    db.prepare("UPDATE dossier_requests SET payment_status = 'paid', status = 'paid-queue' WHERE id = ?").bind(order.id),
  ]);
  // Durable queue first; failed mail returns 503 so Stripe retries the handoff, never loses the paid order.
  if (!order.owner_notified_at && env.NOTIFICATION_TO_EMAIL) {
    const intake = await db.prepare("SELECT company, email, notice FROM dossier_requests WHERE id = ?").bind(order.id).first<{ company: string; email: string; notice: string }>();
    if (!intake) return new Response("Intake unavailable", { status: 503 });
    const text = `Paid dossier ${order.id}\nCompany: ${intake.company}\nReply to: ${intake.email}\nOfficial notice: ${intake.notice}\nFocus / lot: ${order.focus || "Not supplied; confirm with customer"}\n\nConfirm document access, agreed lot and start time; review all documents and amendments, cite every requirement, deliver PDF + editable checklist. Two working days from complete access, or full refund if undeliverable.\n\nNotice snapshot: ${order.notice_snapshot}`;
    const sent = await sendEmail(env, { to: env.NOTIFICATION_TO_EMAIL, subject: `PAID — dossier ${order.id}`, text, html: emailLayout("Paid dossier — action required", `<pre style="white-space:pre-wrap">${escapeHtml(text)}</pre>`) });
    if (!sent) return new Response("Notification pending", { status: 503 });
    await db.prepare("UPDATE dossier_orders SET owner_notified_at = ? WHERE id = ?").bind(now, order.id).run();
  }
  return Response.json({ received: true });
}
