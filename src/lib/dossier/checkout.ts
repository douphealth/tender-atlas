import { z } from "zod";
import { cfBinding } from "@/lib/cf-env";
import { DOSSIER_OFFER, validDossierPrice, type DossierAvailability } from "./offer";
import type { AtlasEnv } from "../procurement/store";
import { storedNotice } from "../procurement/store";
import { fetchNotice, type Notice } from "../procurement/sources";
import { isSourceKey } from "../procurement/catalog";
import { tokenHash, verifyTurnstile } from "../notifications";
import { abs } from "../site";

export type DossierEnv = AtlasEnv & { DOSSIER_SALES_OPEN?: string | undefined };
export const orderInput = z.object({
  source: z.string().refine(isSourceKey), noticeId: z.string().min(1).max(160),
  company: z.string().trim().min(2).max(160), email: z.string().trim().email().max(254),
  focus: z.string().trim().max(2000).default(""), termsAccepted: z.literal(true),
  orderId: z.string().uuid(), accessToken: z.string().regex(/^[a-f0-9]{64}$/),
  turnstileToken: z.string().max(2048), website: z.literal("").optional(),
}).strict();
export function orderableNotice(n: Notice, now = Date.now()): boolean {
  // Avoid selling a two-working-day review against an expired, unknown or urgent deadline.
  return n.stage === "competition" && n.status === "open" && !!n.url && !!n.deadlineAt && Date.parse(n.deadlineAt) - now > 4 * 86400000;
}
export function dossierEnvironment(): DossierEnv {
  return { DB: cfBinding("DB") as unknown as AtlasEnv["DB"], STRIPE_SECRET_KEY: process.env["STRIPE_SECRET_KEY"], STRIPE_PRICE_ID: process.env["STRIPE_PRICE_ID"], TURNSTILE_SECRET_KEY: process.env["TURNSTILE_SECRET_KEY"], SAM_GOV_API_KEY: process.env["SAM_GOV_API_KEY"], DOSSIER_SALES_OPEN: process.env["DOSSIER_SALES_OPEN"], STRIPE_WEBHOOK_SECRET: process.env["STRIPE_WEBHOOK_SECRET"], RESEND_API_KEY: process.env["RESEND_API_KEY"], NOTIFICATION_FROM_EMAIL: process.env["NOTIFICATION_FROM_EMAIL"], NOTIFICATION_TO_EMAIL: process.env["NOTIFICATION_TO_EMAIL"] };
}
async function stripe(env: DossierEnv, path: string, options: RequestInit = {}) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, { ...options, signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...options.headers } });
  if (!response.ok) throw new Error("Payment service unavailable");
  return response.json();
}
export async function availability(env: DossierEnv): Promise<DossierAvailability> {
  if (env.DOSSIER_SALES_OPEN !== "true" || !env.DB || !env.TURNSTILE_SECRET_KEY || !env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID || !env.STRIPE_WEBHOOK_SECRET || !env.RESEND_API_KEY || !env.NOTIFICATION_FROM_EMAIL || !env.NOTIFICATION_TO_EMAIL) return { available: false, reason: "Paid bookings are not open yet. You can request a scope review without payment." };
  try {
    await env.DB.prepare("SELECT id FROM dossier_orders LIMIT 1").first();
    const price = await stripe(env, `prices/${encodeURIComponent(env.STRIPE_PRICE_ID)}`);
    if (!validDossierPrice(price, env.STRIPE_PRICE_ID)) return { available: false, reason: "The pilot price is being confirmed. No payment can be taken." };
    return { available: true, amount: DOSSIER_OFFER.amount, currency: DOSSIER_OFFER.currency };
  } catch { return { available: false, reason: "Secure booking is temporarily unavailable. No payment has been taken." }; }
}
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function createDossierCheckout(request: Request, env: DossierEnv): Promise<Response> {
  // No arbitrary request-id checkout: the public intake route is never authorization for payment.
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Open checkout from the TenderAtlas website." }, 403);
  if (Number(request.headers.get("content-length") ?? 0) > 12000) return reply({ error: "Order is too large." }, 413);
  let data: z.infer<typeof orderInput>;
  try { data = orderInput.parse(await request.json()); } catch { return reply({ error: "Check your company, email and agreement to the dossier terms." }, 400); }
  const ready = await availability(env);
  const db = env.DB;
  if (!ready.available || !db) return reply({ error: ready.reason }, 503);
  const hash = await tokenHash(data.accessToken);
  const existing = await db.prepare("SELECT access_token_hash, checkout_url, payment_status, notice_snapshot, checkout_payload FROM dossier_orders WHERE id = ?").bind(data.orderId).first<{ access_token_hash: string; checkout_url: string | null; payment_status: string; notice_snapshot: string; checkout_payload: string | null }>();
  if (existing && existing.access_token_hash !== hash) return reply({ error: "This order cannot be accessed." }, 403);
  if (existing?.payment_status === "paid") return reply({ error: "This dossier is already paid. Do not pay again." }, 409);
  if (existing?.checkout_url) return reply({ url: existing.checkout_url, orderId: data.orderId });
  if (!await verifyTurnstile(data.turnstileToken, request, env.TURNSTILE_SECRET_KEY)) return reply({ error: "Complete the anti-spam check again." }, 403);
  if (!isSourceKey(data.source)) return reply({ error: "Unknown publisher." }, 400);
  const notice = await fetchNotice(data.source, data.noticeId, env) ?? await storedNotice(data.source, data.noticeId, db);
  if (!notice || !orderableNotice(notice)) return reply({ error: "This tender needs a scope review: the deadline is too close, unknown, or the competition is not open. No payment has been taken." }, 422);
  const now = new Date().toISOString();
  if (!existing) await db.batch([
    db.prepare("INSERT INTO dossier_requests (id, notice, company, email, status, created_at) VALUES (?, ?, ?, ?, 'checkout-pending', ?)").bind(data.orderId, notice.url, data.company, data.email, now),
    db.prepare("INSERT INTO dossier_orders (id, access_token_hash, offer_version, notice_snapshot, focus, terms_accepted_at, expected_amount, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(data.orderId, hash, DOSSIER_OFFER.version, JSON.stringify(notice), data.focus, now, DOSSIER_OFFER.amount, DOSSIER_OFFER.currency, now),
  ]);
  const body = new URLSearchParams({ mode: "payment", "line_items[0][price]": env.STRIPE_PRICE_ID ?? "", "line_items[0][quantity]": "1", customer_email: data.email,
    client_reference_id: data.orderId, "metadata[requestId]": data.orderId, "metadata[offerVersion]": DOSSIER_OFFER.version,
    success_url: abs(`/pricing?order=${data.orderId}&payment=returned`), cancel_url: abs(`/pricing?order=${data.orderId}&payment=cancelled`),
    "automatic_tax[enabled]": "true", billing_address_collection: "required", "tax_id_collection[enabled]": "true", expires_at: String(Math.floor(Date.now() / 1000) + 3600),
    "custom_text[submit][message]": "One tender/one lot, up to 150 pages. Two working days after complete document access. Full refund if we cannot deliver the agreed scope.",
  });
  // Persist exact parameters before the provider call: retries must reuse identical data.
  const payload = existing?.checkout_payload ?? body.toString();
  if (!existing?.checkout_payload) await db.prepare("UPDATE dossier_orders SET checkout_payload = ? WHERE id = ?").bind(payload, data.orderId).run();
  try {
    const session = await stripe(env, "checkout/sessions", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `dossier-${data.orderId}` }, body: payload });
    if (!session.id || typeof session.url !== "string" || new URL(session.url).hostname !== "checkout.stripe.com") throw new Error("Invalid checkout");
    await db.prepare("UPDATE dossier_orders SET stripe_session_id = ?, checkout_url = ? WHERE id = ?").bind(session.id, session.url, data.orderId).run();
    return reply({ url: session.url, orderId: data.orderId });
  } catch { return reply({ error: "Checkout could not be opened. Retry this order; do not submit a new one. If a charge appears, contact the seller with your reference." }, 502); }
}
export async function dossierStatus(request: Request, env: DossierEnv): Promise<Response> {
  const id = new URL(request.url).searchParams.get("order");
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
  if (!id || !z.string().uuid().safeParse(id).success || !/^[a-f0-9]{64}$/.test(token)) return reply({ error: "Your private order confirmation is unavailable in this browser." }, 401);
  if (!env.DB) return reply({ error: "Order confirmation is temporarily unavailable." }, 503);
  const row = await env.DB.prepare("SELECT payment_status FROM dossier_orders WHERE id = ? AND access_token_hash = ?").bind(id, await tokenHash(token)).first<{ payment_status: string }>();
  if (!row) return reply({ error: "Order not found." }, 404);
  return reply({ orderId: id, status: row.payment_status });
}
