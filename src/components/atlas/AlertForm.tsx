import { useState } from "react";
import type { TenderSearch } from "./SearchForm";
import { Turnstile, TURNSTILE_SITE_KEY } from "./Turnstile";

export function AlertForm({ query }: { query: TenderSearch }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const subscribe = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setStatus("");
    try {
      const clean = Object.fromEntries(Object.entries(query).filter(([key, value]) => key !== "page" && value !== undefined));
      const response = await fetch("/api/public/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), query: clean, turnstileToken: data.get("cf-turnstile-response"), website: data.get("website") }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Alert signup failed.");
      setStatus("Check your inbox to verify this alert. Nothing is sent until you confirm.");
      event.currentTarget.reset();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Alert signup failed."); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={subscribe} className="mt-8 rounded-md border border-border bg-card p-5">
      <h2 className="text-xl font-semibold">Get new matches by email</h2>
      <p className="mt-1 text-sm text-muted-foreground">Daily digest for this exact search. Double opt-in; no marketing list.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"><input required name="email" type="email" maxLength={254} placeholder="you@company.com" aria-label="Email for tender alerts" className="h-11 rounded-sm border border-input bg-background px-3" /><button disabled={busy || !TURNSTILE_SITE_KEY} className="rounded-sm bg-accent px-5 font-semibold text-accent-foreground disabled:opacity-50">{busy ? "Creating…" : "Create alert"}</button></div>
      <label className="hidden" aria-hidden>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <div className="mt-3"><Turnstile /></div>
      {!TURNSTILE_SITE_KEY && <p className="mt-2 text-xs text-muted-foreground">Email alerts activate once the owner configures Cloudflare Turnstile, the archive and email delivery. RSS is available now.</p>}
      {status && <p role="status" className="mt-3 text-sm">{status}</p>}
    </form>
  );
}
