import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { AtlasEnv } from "@/lib/procurement/store";
import { escapeHtml, emailLayout, sendEmail, verifyTurnstile } from "@/lib/notifications";

const input = z.object({
  notice: z.string().trim().min(3).max(500), company: z.string().trim().min(2).max(160), email: z.string().trim().email().max(254),
  website: z.string().max(0).optional().or(z.literal("")), turnstileToken: z.string().max(2048),
}).strict();
const env = (): AtlasEnv => ({
  DB: process.env["DB"] as unknown as AtlasEnv["DB"], TURNSTILE_SECRET_KEY: process.env["TURNSTILE_SECRET_KEY"],
  RESEND_API_KEY: process.env["RESEND_API_KEY"], NOTIFICATION_FROM_EMAIL: process.env["NOTIFICATION_FROM_EMAIL"], NOTIFICATION_TO_EMAIL: process.env["NOTIFICATION_TO_EMAIL"],
});

export const Route = createFileRoute("/api/public/dossier-requests")({
  server: { handlers: { POST: async ({ request }) => {
    let data: z.infer<typeof input>;
    try { data = input.parse(await request.json()); } catch { return Response.json({ error: "Check the tender, company and email fields." }, { status: 400 }); }
    const environment = env();
    if (!environment.DB || !environment.TURNSTILE_SECRET_KEY) return Response.json({ error: "Dossier requests are not configured yet." }, { status: 503 });
    if (!await verifyTurnstile(data.turnstileToken, request, environment.TURNSTILE_SECRET_KEY)) return Response.json({ error: "Anti-spam verification failed. Please try again." }, { status: 403 });
    const id = crypto.randomUUID();
    await environment.DB.prepare("INSERT INTO dossier_requests (id, notice, company, email, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, data.notice, data.company, data.email, new Date().toISOString()).run();
    if (environment.NOTIFICATION_TO_EMAIL) await sendEmail(environment, {
      to: environment.NOTIFICATION_TO_EMAIL, subject: `Dossier request ${id}`,
      html: emailLayout("New dossier request", `<p><strong>${escapeHtml(data.company)}</strong></p><p>${escapeHtml(data.notice)}</p><p>Reply to: ${escapeHtml(data.email)}</p><p>Reference: ${id}</p>`),
      text: `Dossier request ${id}\n\n${data.company}\n${data.notice}\nReply to: ${data.email}`,
    });
    return Response.json({ ok: true, id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } } },
});
