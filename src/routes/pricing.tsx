import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { pageHead } from "@/lib/seo";

const CONTACT = import.meta.env["VITE_CONTACT_EMAIL"] as string | undefined;

export const Route = createFileRoute("/pricing")({
  head: () => pageHead({ title: "Tender Readiness Dossiers", description: "Document-backed bid/no-bid dossiers: mandatory requirements, risks and open questions, each cited to the page of the official tender documents.", path: "/pricing" }),
  component: Pricing,
});

const INCLUDES = [
  "Mandatory exclusion and selection criteria, quoted with document and page reference",
  "Required certificates, turnover and reference thresholds",
  "Submission format, deadline time and time zone, lot structure",
  "Risks and ambiguities worth a clarification question",
  "An explicit list of what the documents do not say",
];

function Pricing() {
  const [f, setF] = useState({ notice: "", company: "", email: "" });
  const body = `Dossier request\n\nNotice link or ID: ${f.notice}\nCompany: ${f.company}\nReply to: ${f.email}`;
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 lg:grid-cols-2">
      <div>
        <p className="eyebrow">Pilot programme</p>
        <h1 className="mt-1 text-4xl font-semibold">Tender Readiness Dossiers</h1>
        <p className="mt-4 text-lg text-muted-foreground">Send us one tender. We read the full tender documents and return a dossier where every requirement is cited to its source page — so you can decide to bid in minutes, not days.</p>
        <ul className="mt-8 space-y-3">{INCLUDES.map((i) => <li key={i} className="border-l-2 border-accent pl-3">{i}</li>)}</ul>
        <p className="mt-8 text-sm text-muted-foreground">Dossiers are prepared on request during the pilot. Price and turnaround are confirmed by reply before any work starts — nothing is charged automatically.</p>
      </div>
      <form
        className="space-y-4 rounded-md border border-border bg-card p-6"
        onSubmit={(e) => { e.preventDefault(); if (CONTACT) window.location.href = `mailto:${CONTACT}?subject=${encodeURIComponent("Dossier request")}&body=${encodeURIComponent(body)}`; }}
      >
        <h2 className="text-xl font-semibold">Request a dossier</h2>
        {([["notice", "Tender link or notice ID"], ["company", "Your company"], ["email", "Your email"]] as const).map(([k, label]) => (
          <label key={k} className="block text-sm">
            <span className="text-muted-foreground">{label}</span>
            <input required type={k === "email" ? "email" : "text"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="mt-1 h-11 w-full rounded-sm border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring" />
          </label>
        ))}
        <button disabled={!CONTACT} className="h-11 w-full rounded-sm bg-accent font-semibold text-accent-foreground disabled:opacity-50">Send request by email</button>
        {!CONTACT && <p className="text-xs text-destructive">Requests are not open yet: no contact address is configured.</p>}
        <p className="text-xs text-muted-foreground">Opens your email app with the details filled in. Nothing is stored on this site.</p>
      </form>
    </div>
  );
}
