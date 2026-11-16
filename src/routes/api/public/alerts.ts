import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { AtlasEnv } from "@/lib/procurement/store";
import { alertQuerySchema, emailSchema, escapeHtml, emailLayout, sendEmail, tokenHash, verifyTurnstile } from "@/lib/notifications";
import { abs } from "@/lib/site";

const input = z.object({ email: emailSchema, query: alertQuerySchema, turnstileToken: z.string().max(2048), website: z.string().max(0).optional().or(z.literal("")) }).strict();
const env = (): AtlasEnv => ({
  DB: process.env["DB"] as unknown as AtlasEnv["DB"], TURNSTILE_SECRET_KEY: process.env["TURNSTILE_SECRET_KEY"],
  RESEND_API_KEY: process.env["RESEND_API_KEY"], NOTIFICATION_FROM_EMAIL: process.env["NOTIFICATION_FROM_EMAIL"],
});

export const Route = createFileRoute("/api/public/alerts")({
  server: { handlers: { POST: async ({ request }) => {
    let data: z.infer<typeof input>;
    try { data = input.parse(await request.json()); } catch { return Response.json({ error: "Enter a valid email and search." }, { status: 400 }); }
    const environment = env();
    if (!environment.DB || !environment.TURNSTILE_SECRET_KEY || !environment.RESEND_API_KEY || !environment.NOTIFICATION_FROM_EMAIL) return Response.json({ error: "Email alerts are not configured yet. You can use the RSS feed now." }, { status: 503 });
    if (!await verifyTurnstile(data.turnstileToken, request, environment.TURNSTILE_SECRET_KEY)) return Response.json({ error: "Anti-spam verification failed. Please try again." }, { status: 403 });
    const verifyToken = crypto.randomUUID() + crypto.randomUUID();
    const unsubscribeToken = crypto.randomUUID() + crypto.randomUUID();
    const id = crypto.randomUUID();
    const query = JSON.stringify(data.query);
    await environment.DB.prepare(`INSERT INTO alert_subscriptions (id, email, query, verify_token_hash, unsubscribe_token_hash, unsubscribe_token, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(email, query) DO UPDATE SET verified=0, verify_token_hash=excluded.verify_token_hash,
      unsubscribe_token_hash=excluded.unsubscribe_token_hash, unsubscribe_token=excluded.unsubscribe_token, created_at=excluded.created_at`)
      .bind(id, data.email.toLowerCase(), query, await tokenHash(verifyToken), await tokenHash(unsubscribeToken), unsubscribeToken, new Date().toISOString()).run();
    const verifyUrl = abs(`/alerts/verify?token=${encodeURIComponent(verifyToken)}`);
    const sent = await sendEmail(environment, { to: data.email, subject: "Confirm your TenderAtlas alert",
      html: emailLayout("Confirm your tender alert", `<p>Confirm this daily search alert:</p><pre style="white-space:pre-wrap;background:#f5f3ed;padding:12px">${escapeHtml(query)}</pre><p><a href="${verifyUrl}" style="color:#a54124">Verify and activate alerts</a></p>`),
      text: `Confirm your TenderAtlas alert: ${verifyUrl}` });
    if (!sent) return Response.json({ error: "The confirmation email could not be sent. Please try again." }, { status: 502 });
    return Response.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } } },
});
