import { createFileRoute } from "@tanstack/react-router";
import { dossierEnvironment } from "@/lib/dossier/checkout";
import { handleDossierWebhook } from "@/lib/dossier/webhook";

export const Route = createFileRoute("/api/public/stripe/webhook")({
  server: { handlers: { POST: async ({ request }) => {
    try { return await handleDossierWebhook(request, {
      ...dossierEnvironment(), STRIPE_WEBHOOK_SECRET: process.env["STRIPE_WEBHOOK_SECRET"],
      RESEND_API_KEY: process.env["RESEND_API_KEY"], NOTIFICATION_FROM_EMAIL: process.env["NOTIFICATION_FROM_EMAIL"], NOTIFICATION_TO_EMAIL: process.env["NOTIFICATION_TO_EMAIL"],
    }); } catch { return new Response("Payment confirmation will be retried", { status: 503 }); }
  } } },
});
