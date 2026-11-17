import { Link } from "@tanstack/react-router";
import { SOURCES } from "@/lib/procurement/catalog";
import type { Notice } from "@/lib/procurement/sources";

/** Per-division summary computed only from the notices already loaded for the page. */
const eur = (n: number) => new Intl.NumberFormat("en", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 }).format(n);

export function CpvInsights({ division, items }: { division: { code: string; name: string }; items: Notice[] }) {
  const dv = division.code.slice(0, 2);
  const now = Date.now();
  const open = items.filter((n) => n.deadlineAt && Date.parse(n.deadlineAt) > now);
  const valued = items.filter((n) => typeof n.valueEur === "number" && n.valueEur! > 0);
  const total = valued.reduce((s, n) => s + (n.valueEur as number), 0);
  const byCountry = new Map<string, { name: string; n: number; open: number; value: number }>();
  for (const n of items) {
    const k = n.countryName ?? "Not stated";
    const e = byCountry.get(k) ?? { name: k, n: 0, open: 0, value: 0 };
    e.n++; if (open.includes(n)) e.open++; if (typeof n.valueEur === "number") e.value += n.valueEur; byCountry.set(k, e);
  }
  const countries = [...byCountry.values()].sort((a, b) => b.n - a.n);
  const buyers = [...items.reduce((m, n) => (n.buyer ? m.set(n.buyer, (m.get(n.buyer) ?? 0) + 1) : m), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const srcs = [...new Set(items.map((n) => n.source))].map((k) => SOURCES[k]?.label ?? k);
  const top = countries[0];
  const answer = items.length
    ? `In the last 30 days Tender Atlas found ${items.length} public tenders classified under CPV ${division.code} (${division.name}), from ${srcs.join(", ")}. ${countries.length} ${countries.length === 1 ? "country" : "countries"} published them${top ? `, led by ${top.name} with ${top.n}` : ""}. ${open.length} still have a future deadline${valued.length ? `, and ${valued.length} state a value totalling about ${eur(total)} (indicative ECB conversion)` : ""}.`
    : `No CPV ${division.code} (${division.name}) notices were returned in the last 30 days from the sources we check. Set an alert to hear when new ones appear.`;
  const faq = [
    { q: `What is CPV code ${division.code}?`, a: `CPV (Common Procurement Vocabulary) is the EU classification used to describe public contracts. Division ${dv} covers ${division.name.toLowerCase()}; any CPV code starting with ${dv} belongs to it.` },
    { q: `How many ${division.name.toLowerCase()} tenders are open right now?`, a: answer },
    { q: `Which countries publish the most CPV ${dv} tenders?`, a: countries.length ? countries.slice(0, 5).map((c) => `${c.name} (${c.n})`).join(", ") + ", based on notices from the last 30 days." : `None in the last 30 days from the sources we check.` },
    { q: `Where do these tender notices come from?`, a: `Official publication platforms: ${(["ted", "fr", "gr", "uk"] as const).map((k) => `${SOURCES[k].label} (${SOURCES[k].name})`).join("; ")}. Always confirm the deadline and documents on the official notice before bidding.` },
    { q: `How do I get alerts for new CPV ${dv} tenders?`, a: `Set up a Tender Atlas email alert for CPV division ${dv} (see the alerts page for options and pricing) to be notified when new matching notices are published.` },
  ];
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })) }).replace(/</g, "\u003c");
  return (
    <>
      <section className="mt-8 rounded-xl border bg-card p-5"><h2 className="text-sm font-semibold uppercase tracking-wide text-accent">At a glance</h2><p className="mt-2 leading-relaxed">{answer}</p></section>
      {countries.length > 0 && (
        <section className="mt-12"><h2 className="text-2xl font-semibold">{division.name} tenders by country (last 30 days)</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="p-3">Country</th><th className="p-3">Notices</th><th className="p-3">Open</th><th className="p-3">Stated value (EUR)</th></tr></thead>
            <tbody>{countries.map((c) => <tr key={c.name} className="border-t"><td className="p-3 font-medium">{c.name}</td><td className="p-3">{c.n}</td><td className="p-3">{c.open}</td><td className="p-3">{c.value ? eur(c.value) : "—"}</td></tr>)}</tbody></table></div>
        </section>
      )}
      {buyers.length > 0 && (
        <section className="mt-12"><h2 className="text-2xl font-semibold">Most active buyers</h2>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">{buyers.map(([b, n]) => <li key={b} className="flex justify-between gap-3 rounded-lg border p-3"><span>{b}</span><span className="text-muted-foreground">{n}</span></li>)}</ul>
        </section>
      )}
      <section className="mt-12"><h2 className="text-2xl font-semibold">Frequently asked questions</h2>
        <div className="mt-4 divide-y rounded-xl border">{faq.map((x) => <div key={x.q} className="p-5"><h3 className="font-semibold">{x.q}</h3><p className="mt-2 leading-relaxed text-muted-foreground">{x.a}</p></div>)}</div>
        <p className="mt-4 text-sm"><Link to="/alerts" className="text-accent hover:underline">Set up a CPV {dv} alert →</Link></p>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      </section>
    </>
  );
}
