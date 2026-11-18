import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, FileCheck2, LockKeyhole, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DOSSIER_OFFER, type DossierAvailability } from "@/lib/dossier/offer";
import type { Notice } from "@/lib/procurement/sources";
import { fmtDate } from "./format";
import { Turnstile, TURNSTILE_SITE_KEY } from "./Turnstile";

function newOrder() {
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { id: crypto.randomUUID(), token };
}
export function DossierOrder({ notice }: { notice: Notice }) {
  const [availability, setAvailability] = useState<DossierAvailability>();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const order = useRef<{ id: string; token: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/stripe/checkout", { signal: controller.signal }).then((r) => r.json()).then(setAvailability).catch(() => { if (!controller.signal.aborted) setAvailability({ available: false, reason: "Secure booking is temporarily unavailable." }); });
    return () => controller.abort();
  }, []);
  const eligible = notice.stage === "competition" && notice.status === "open" && !!notice.url && !!notice.deadlineAt && Date.parse(notice.deadlineAt) - Date.now() > 4 * 86400000;
  const canOrder = eligible && availability?.available && !!TURNSTILE_SITE_KEY;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !token) return;
    setBusy(true); setError("");
    const values = new FormData(event.currentTarget);
    try {
      if (!order.current) order.current = newOrder();
      // Private capability never enters the URL, analytics or localStorage.
      sessionStorage.setItem(`dossier:${order.current.id}`, order.current.token);
      const response = await fetch("/api/public/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        source: notice.source, noticeId: notice.noticeId, company: values.get("company"), email: values.get("email"), focus: values.get("focus"),
        website: values.get("website"), termsAccepted: values.get("terms") === "on", orderId: order.current.id, accessToken: order.current.token, turnstileToken: token,
      }) });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? "Checkout could not be opened.");
      if (new URL(result.url).hostname !== "checkout.stripe.com") throw new Error("Unexpected payment destination.");
      window.location.assign(result.url);
    } catch (e) { setError(e instanceof Error ? e.message : "Checkout is unavailable."); setBusy(false); }
  };
  return <section aria-labelledby="dossier-order-title" className="border-t-4 border-accent bg-card p-5 ring-1 ring-border">
    <div className="flex items-center justify-between gap-3"><span className="eyebrow">Bid decision · pilot</span><FileCheck2 aria-hidden className="size-5 text-accent" /></div>
    <h2 id="dossier-order-title" className="mt-3 text-2xl font-semibold">Know before you bid.</h2>
    <p className="mt-2 text-sm text-muted-foreground">A page-cited Readiness Dossier for this tender. Evidence first. No invented eligibility.</p>
    <div className="mt-5 flex items-baseline gap-2"><span className="font-mono text-3xl font-semibold">€290</span><span className="text-xs text-muted-foreground">one-off · no subscription</span></div>
    <p className="mt-2 text-xs text-muted-foreground">{DOSSIER_OFFER.scope}. PDF + editable checklist.</p>
    <ul className="mt-5 space-y-2.5 text-sm">{["Page-cited eligibility matrix", "Submission & evidence checklist", "Prioritised risks and clarification questions", "Document versions, amendments & unknowns"].map((item) => <li key={item} className="flex gap-2"><Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />{item}</li>)}</ul>
    <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">{DOSSIER_OFFER.delivery}</p>
    {canOrder ? <Button size="lg" className="mt-4 h-auto min-h-11 w-full whitespace-normal bg-accent px-3 text-accent-foreground hover:bg-accent/90" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>Order this tender’s dossier <ArrowRight /></Button> : <div className="mt-4"><p role="status" className="text-xs text-muted-foreground">{!availability ? "Checking secure booking…" : !eligible ? "Close or undisclosed deadline, or a closed competition: request a scope review before paying." : availability.reason}</p><Button asChild variant="outline" className="mt-3 h-auto min-h-10 w-full whitespace-normal"><Link to="/pricing" search={{ source: notice.source, notice: notice.noticeId }}>Request a scope review <ArrowRight /></Link></Button></div>}
    {expanded && canOrder && <form onSubmit={submit} className="mt-5 space-y-4 border-t border-border pt-5">
      <div className="border-l-2 border-accent pl-3 text-xs"><p className="font-medium break-words">{notice.title}</p><p className="mt-1 text-muted-foreground break-words">{notice.noticeId} · {notice.buyer ?? "Buyer not disclosed"}</p><p className="mt-1 text-muted-foreground">Deadline: {fmtDate(notice.deadlineAt)}{notice.deadlineTimezone ? ` (${notice.deadlineTimezone})` : " · time zone not disclosed"}</p></div>
      <label className="block text-sm">Company<input name="company" required minLength={2} maxLength={160} autoComplete="organization" className="mt-1 h-10 w-full rounded-sm border border-input bg-background px-3" /></label>
      <label className="block text-sm">Delivery email<input name="email" required type="email" maxLength={254} autoComplete="email" className="mt-1 h-10 w-full rounded-sm border border-input bg-background px-3" /></label>
      <label className="block text-sm">Lot and company context <span className="text-muted-foreground">(optional)</span><textarea name="focus" maxLength={2000} rows={3} placeholder="Lot number, capabilities, turnover or questions to check. No passwords or sensitive documents." className="mt-1 w-full rounded-sm border border-input bg-background p-3 text-sm" /></label>
      <details className="text-xs leading-relaxed text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">Scope, delivery & refund terms</summary><p className="mt-2">{DOSSIER_OFFER.refund}</p><p className="mt-2">No bid drafting, legal advice, translation, ongoing amendment monitoring or guaranteed qualification. Your team makes the final bid decision. Amendments are assessed through the dossier’s review date only.</p></details>
      <label className="flex items-start gap-2 text-xs leading-relaxed"><input type="checkbox" name="terms" required className="mt-0.5 shrink-0 accent-accent" /><span>I accept the scope, delivery and refund terms, and understand this is a document review, not a guarantee of eligibility or award. <Link to="/privacy" className="underline">Privacy notice</Link>.</span></label>
      <label className="hidden" aria-hidden>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <Turnstile onToken={setToken} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy || !token} className="h-auto min-h-11 w-full whitespace-normal bg-accent text-accent-foreground hover:bg-accent/90">{busy ? <><LoaderCircle className="animate-spin" />Opening checkout…</> : <><LockKeyhole />Continue to Stripe · €290</>}</Button>
      <p className="text-xs text-muted-foreground">The final total appears on Stripe before you pay.</p>
    </form>}
    <p className="mt-4 text-xs text-muted-foreground">Full refund if we cannot deliver the agreed scope.</p>
  </section>;
}
