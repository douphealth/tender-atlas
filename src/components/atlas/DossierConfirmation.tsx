import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DOSSIER_OFFER } from "@/lib/dossier/offer";

export function DossierConfirmation({ orderId, cancelled }: { orderId: string; cancelled: boolean }) {
  const [status, setStatus] = useState("checking");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true; let timer: ReturnType<typeof setTimeout> | undefined; let attempts = 0;
    const check = async () => {
      try {
        const token = sessionStorage.getItem(`dossier:${orderId}`);
        if (!token) throw new Error("Open this page in the browser used for checkout. Keep your Stripe receipt as proof of payment.");
        const response = await fetch(`/api/public/stripe/checkout?order=${encodeURIComponent(orderId)}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json() as { status?: string; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Confirmation unavailable.");
        if (!active) return;
        setStatus(data.status ?? "pending"); setError("");
        if (data.status === "pending" && attempts++ < 6) timer = setTimeout(check, 3000);
      } catch (e) { if (active) { setStatus("unknown"); setError(e instanceof Error ? e.message : "Confirmation unavailable."); } }
    };
    void check();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [orderId, refresh]);
  const paid = status === "paid";
  return <section aria-live="polite" className="mb-10 border-l-4 border-accent bg-secondary p-6">
    <h2 className="text-2xl font-semibold">{paid ? "Payment confirmed. Your dossier is queued." : cancelled ? "Checkout was cancelled." : "Checking your payment confirmation"}</h2>
    <p className="mt-2 break-words font-mono text-xs">Order reference: {orderId}</p>
    <p className="mt-3 text-sm">{paid ? "We will contact your delivery email to confirm document access and the selected lot. Keep your reference and Stripe receipt." : "A return from checkout is not proof of payment. Do not pay again while confirmation is pending."}</p>
    {paid && <p className="mt-2 text-sm text-muted-foreground">{DOSSIER_OFFER.delivery} {DOSSIER_OFFER.refund}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {!paid && <Button variant="outline" className="mt-4" onClick={() => setRefresh((r) => r + 1)}>Check payment again</Button>}
  </section>;
}
