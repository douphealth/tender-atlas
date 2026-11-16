import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { DossierForm } from "@/components/atlas/DossierForm";
import { SampleDossier } from "@/components/atlas/SampleDossier";

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
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <p className="eyebrow">Pilot programme</p>
          <h1 className="mt-1 text-4xl font-semibold">Tender Readiness Dossiers</h1>
          <p className="mt-4 text-lg text-muted-foreground">Send us one tender. We read the full tender documents and return a dossier where every requirement is cited to its source page — so you can decide to bid in minutes, not days.</p>
          <ul className="mt-8 space-y-3">{INCLUDES.map((i) => <li key={i} className="border-l-2 border-accent pl-3">{i}</li>)}</ul>
          <p className="mt-8 text-sm text-muted-foreground">Dossiers are prepared on request during the pilot. Price and turnaround are confirmed by reply before any work starts — nothing is charged automatically.</p>
        </div>
        <DossierForm />
      </div>
      <SampleDossier />
    </div>
  );
}
