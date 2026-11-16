import { z } from "zod";
import { SITE_URL } from "./site";
import type { AtlasEnv, D1Database } from "./procurement/store";
import { parseSearch } from "./procurement/sources";
import { storedSearch } from "./procurement/store";
import { abs } from "./site";

export const emailSchema = z.string().trim().email().max(254);
export const alertQuerySchema = z.object({
  q: z.string().max(100).optional(), source: z.string().max(20).optional(), country: z.string().max(3).optional(),
  cpv: z.string().max(12).optional(), days: z.number().int().min(7).max(90).optional(),
  deadline: z.enum(["any", "48h", "7d"]).optional(), minValueEur: z.number().min(0).max(1e12).optional(), maxValueEur: z.number().min(0).max(1e12).optional(),
}).strict();

export async function verifyTurnstile(token: string, request: Request, secret?: string): Promise<boolean> {
  if (!secret || !token) return false;
  const body = new URLSearchParams({ secret, response: token.slice(0, 2048) });
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) body.set("remoteip", ip);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const result = await response.json() as { success?: boolean };
    return response.ok && result.success === true;
  } catch { return false; }
}

export async function sendEmail(env: AtlasEnv, message: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.NOTIFICATION_FROM_EMAIL) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.NOTIFICATION_FROM_EMAIL, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    });
    return response.ok;
  } catch { return false; }
}

export async function tokenHash(token: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function emailLayout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f3ed;color:#17263e;font-family:Arial,sans-serif"><main style="max-width:640px;margin:auto;padding:32px"><p style="font-size:12px;letter-spacing:2px;color:#a54124">TENDERATLAS</p><h1 style="font-family:Georgia,serif;font-size:30px">${escapeHtml(title)}</h1>${body}<p style="font-size:12px;color:#667085;margin-top:32px">Official notice data remains authoritative. Always verify the source before bidding.</p></main></body></html>`;
}

export function actionPage(title: string, message: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>${escapeHtml(title)} | TenderAtlas</title></head><body style="margin:0;background:#f5f3ed;color:#17263e;font-family:Arial,sans-serif"><main style="max-width:640px;margin:12vh auto;padding:32px"><p style="letter-spacing:2px;color:#a54124">TENDERATLAS</p><h1 style="font-family:Georgia,serif">${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p><a href="/" style="color:#a54124">Return to TenderAtlas</a></p></main></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

export async function sendDueAlerts(env: AtlasEnv): Promise<{ sent: number; subscriptions: number }> {
  if (!env.DB || !env.RESEND_API_KEY || !env.NOTIFICATION_FROM_EMAIL) return { sent: 0, subscriptions: 0 };
  const subscriptions = await env.DB.prepare("SELECT id, email, query FROM alert_subscriptions WHERE verified = 1 LIMIT 500").all<{ id: string; email: string; query: string }>();
  let sent = 0;
  for (const subscription of subscriptions.results) {
    const params = parseSearch(JSON.parse(subscription.query));
    const result = await storedSearch({ ...params, days: 7, page: 1 }, env.DB);
    if (!result) continue;
    const delivered = await env.DB.prepare("SELECT notice_id FROM alert_deliveries WHERE subscription_id = ?").bind(subscription.id).all<{ notice_id: string }>();
    const previous = new Set(delivered.results.map((r) => r.notice_id));
    const cutoff = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const notices = result.items.filter((n) => n.publishedAt && n.publishedAt >= cutoff && !previous.has(n.id)).slice(0, 20);
    if (!notices.length) continue;
    const list = notices.map((n) => `<li style="margin:16px 0"><a href="${abs(`/tenders/${n.source}/${encodeURIComponent(n.noticeId)}`)}" style="color:#17263e"><strong>${escapeHtml(n.title)}</strong></a><br><span style="color:#667085;font-size:13px">${escapeHtml(n.buyer ?? "Buyer not disclosed")} · ${escapeHtml(n.deadlineAt ?? "Deadline not disclosed")}</span></li>`).join("");
    const unsubscribe = await env.DB.prepare("SELECT unsubscribe_token FROM alert_subscriptions WHERE id = ?").bind(subscription.id).first<{ unsubscribe_token: string }>();
    if (!unsubscribe) continue;
    const unsubscribeUrl = abs(`/alerts/unsubscribe?token=${encodeURIComponent(unsubscribe.unsubscribe_token)}`);
    const ok = await sendEmail(env, { to: subscription.email, subject: `${notices.length} new matching public tender${notices.length === 1 ? "" : "s"}`,
      html: emailLayout("New tenders matching your search", `<ul style="padding-left:20px">${list}</ul><p><a href="${unsubscribeUrl}" style="color:#a54124">Unsubscribe from this alert</a></p>`),
      text: `${notices.map((n) => `${n.title}\n${abs(`/tenders/${n.source}/${encodeURIComponent(n.noticeId)}`)}`).join("\n\n")}\n\nUnsubscribe: ${unsubscribeUrl}` });
    if (!ok) continue;
    const now = new Date().toISOString();
    await env.DB.batch(notices.map((n) => env.DB!.prepare("INSERT OR IGNORE INTO alert_deliveries (subscription_id, notice_id, sent_at) VALUES (?, ?, ?)").bind(subscription.id, n.id, now)));
    sent++;
  }
  return { sent, subscriptions: subscriptions.results.length };
}

export async function dbOrThrow(db?: D1Database): Promise<D1Database> {
  if (!db) throw new Error("Cloudflare D1 is not configured");
  return db;
}
