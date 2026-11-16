import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { AtlasEnv } from "@/lib/procurement/store";
import { abs } from "@/lib/site";

const input = z.object({ requestId: z.string().uuid() }).strict();
const env = (): AtlasEnv => ({ DB: process.env["DB"] as unknown as AtlasEnv["DB"], STRIPE_SECRET_KEY: process.env["STRIPE_SECRET_KEY"], STRIPE_PRICE_ID: process.env["STRIPE_PRICE_ID"] });

export const Route = createFileRoute("/api/public/stripe/checkout")({
  server: { handlers: { POST: async ({ request }) => {
    let data: z.infer<typeof input>;
    try { data = input.parse(await request.json()); } catch { return Response.json({ error: "A valid dossier request is required." }, { status: 400 }); }
    const environment = env();
    if (!environment.DB || !environment.STRIPE_SECRET_KEY || !environment.STRIPE_PRICE_ID) return Response.json({ error: "Secure checkout is not configured yet." }, { status: 503 });
    const dossier = await environment.DB.prepare("SELECT id, email FROM dossier_requests WHERE id = ?").bind(data.requestId).first<{ id: string; email: string }>();
    if (!dossier) return Response.json({ error: "Dossier request not found." }, { status: 404 });
    const body = new URLSearchParams({
      mode: "payment", "line_items[0][price]": environment.STRIPE_PRICE_ID, "line_items[0][quantity]": "1",
      success_url: abs("/pricing?payment=success&session_id={CHECKOUT_SESSION_ID}"), cancel_url: abs("/pricing?payment=cancelled"),
      customer_email: dossier.email, client_reference_id: dossier.id, "metadata[requestId]": dossier.id,
    });
    try {
      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${environment.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
      const result = await response.json() as { url?: string };
      if (!response.ok || !result.url) return Response.json({ error: "Stripe could not create the checkout. Please try again." }, { status: 502 });
      return Response.json({ url: result.url }, { headers: { "Cache-Control": "no-store" } });
    } catch { return Response.json({ error: "Stripe is temporarily unavailable." }, { status: 502 }); }
  } } },
});
