import { useState, type FormEvent } from "react";
import { Turnstile, TURNSTILE_SITE_KEY } from "./Turnstile";
import { Button } from "@/components/ui/button";

export function DossierForm({ notice = "" }: { notice?: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [requestId, setRequestId] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setState("sending"); setMessage("");
    try {
      const response = await fetch("/api/public/dossier-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        notice: data.get("notice"), company: data.get("company"), email: data.get("email"), website: data.get("website"), turnstileToken: data.get("cf-turnstile-response"),
      }) });
      const result = await response.json() as { ok?: boolean; id?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Your request could not be sent.");
      setRequestId(result.id ?? ""); setState("sent"); form.reset();
    } catch (error) { setState("error"); setMessage(error instanceof Error ? error.message : "Your request could not be sent."); }
  };
  return (
    <div className="self-start space-y-4 rounded-md border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">Request a scope review</h2>
      {state === "sent" ? <div className="rounded-md border border-success/40 bg-success/10 p-4"><p className="font-medium text-success">Request received.</p><p className="mt-1 text-sm">Your reference is <span className="font-mono">{requestId}</span>. We will reply before any chargeable work begins.</p></div> : (
      <form onSubmit={submit} className="space-y-4">
        {([["notice", "Tender link or notice ID"], ["company", "Your company"], ["email", "Your email"]] as const).map(([k, label]) => (
          <label key={k} className="block text-sm"><span className="text-muted-foreground">{label}</span><input name={k} defaultValue={k === "notice" ? notice : undefined} required maxLength={k === "notice" ? 500 : k === "email" ? 254 : 160} type={k === "email" ? "email" : "text"} className="mt-1 h-11 w-full rounded-sm border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring" /></label>
        ))}
        <label className="hidden" aria-hidden>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <Turnstile />
        <Button disabled={!TURNSTILE_SITE_KEY || state === "sending"} className="h-11 w-full rounded-sm bg-accent font-semibold text-accent-foreground hover:bg-accent/90">{state === "sending" ? "Sending…" : "Send scope review request"}</Button>
        {!TURNSTILE_SITE_KEY && <p className="text-xs text-destructive">Requests are not open yet: anti-spam protection is not configured.</p>}
        {state === "error" && <p role="alert" className="text-sm text-destructive">{message}</p>}
        <p className="text-xs text-muted-foreground">Your details are stored only to answer this request. See the privacy notice. No automatic charge.</p>
      </form>)}
      {state === "error" && requestId && <p role="alert" className="text-sm text-destructive">{message}</p>}
    </div>
  );
}
