import { createFileRoute } from "@tanstack/react-router";
import { availability, createDossierCheckout, dossierEnvironment, dossierStatus } from "@/lib/dossier/checkout";

export const Route = createFileRoute("/api/public/stripe/checkout")({
  server: { handlers: {
    GET: async ({ request }) => new URL(request.url).searchParams.has("order")
      ? dossierStatus(request, dossierEnvironment())
      : Response.json(await availability(dossierEnvironment()), { headers: { "Cache-Control": "no-store" } }),
    POST: async ({ request }) => {
      try { return await createDossierCheckout(request, dossierEnvironment()); }
      catch { return Response.json({ error: "Secure booking is temporarily unavailable. Please retry the same order." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
    },
  } },
});
