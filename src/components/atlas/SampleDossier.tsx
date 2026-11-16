import { useState } from "react";

const SECTIONS = {
  Requirements: [
    ["Mandatory turnover", "Illustrative requirement: €2m average annual turnover.", "Sample specification · p. 18 · §4.2"],
    ["Reference projects", "Illustrative requirement: two comparable deployments in the last three years.", "Sample selection document · p. 7 · §2"],
    ["Submission", "Illustrative requirement: two files, PDF/A, named by lot.", "Sample instructions · p. 11 · §3.1"],
  ],
  "Risk register": [
    ["High · Ambiguous lot rule", "The sample text does not say whether one reference may cover two lots.", "Ask a clarification question before pricing"],
    ["Medium · Time zone", "The sample deadline has a date but no time zone.", "Verify in the official portal"],
    ["Medium · Certificate expiry", "The sample certificate requirement has no validity window.", "Request the accepted evidence format"],
  ],
  "Open questions": [
    ["Q1", "Can a consortium combine references across members?", "Not answered in the illustrative documents"],
    ["Q2", "Is a signed framework acceptance required at submission?", "Not answered in the illustrative documents"],
    ["Q3", "Are electronic signatures from other EEA states accepted?", "Not answered in the illustrative documents"],
  ],
} as const;

export function SampleDossier() {
  const [active, setActive] = useState<keyof typeof SECTIONS>("Requirements");
  return (
    <section className="mt-16 rounded-lg border border-border bg-ink-deep p-6 text-primary-foreground sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow !text-primary-foreground/60">Interactive product tour</p><h2 className="mt-1 text-3xl font-semibold">Inside a Readiness Dossier</h2></div><span className="rounded-sm border border-primary-foreground/20 px-2 py-1 font-mono text-[10px]">ILLUSTRATIVE · NOT A REAL TENDER</span></div>
      <p className="mt-3 max-w-2xl text-sm text-primary-foreground/70">This fictional hospital IT example demonstrates the format only. Its requirements and page references are deliberately labelled samples, not procurement facts.</p>
      <div className="mt-6 flex gap-1 overflow-x-auto" role="tablist" aria-label="Sample dossier sections">{(Object.keys(SECTIONS) as (keyof typeof SECTIONS)[]).map((name) => <button key={name} role="tab" aria-selected={active === name} onClick={() => setActive(name)} className={`rounded-sm px-3 py-2 text-sm ${active === name ? "bg-accent text-accent-foreground" : "bg-primary-foreground/5 hover:bg-primary-foreground/10"}`}>{name}</button>)}</div>
      <div className="mt-4 grid gap-3" role="tabpanel">{SECTIONS[active].map(([title, detail, citation]) => <article key={title} className="rounded-md border border-primary-foreground/15 bg-primary-foreground/5 p-4"><h3 className="font-sans text-sm font-semibold">{title}</h3><p className="mt-2 text-sm text-primary-foreground/80">{detail}</p><p className="mt-3 border-l-2 border-accent pl-2 font-mono text-[11px] text-primary-foreground/60">{citation}</p></article>)}</div>
      <p className="mt-4 text-xs text-primary-foreground/60">A real dossier also includes an explicit list of what the official documents do not disclose.</p>
    </section>
  );
}
