import { createFileRoute, Link } from "@tanstack/react-router";
import { COUNTRIES, SOURCES } from "@/lib/procurement/catalog";
import { itemList, jsonLd, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/countries/")({
  head: () => pageHead({
    title: "Public tenders by country",
    description: "Browse official public procurement notices across Europe, the United Kingdom and the United States by country and sector.",
    path: "/countries",
    jsonLd: jsonLd([itemList("Public tenders by country", COUNTRIES.map((c) => ({ name: c.name, path: `/countries/${c.iso2}/tenders` })))]),
  }),
  component: () => (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="eyebrow">Directory</p>
      <h1 className="mt-1 text-4xl font-semibold">Tenders by country</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">Official notices grouped by the country named on the publisher record, covering Europe, the United Kingdom and the United States.</p>
      <ul className="mt-8 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {COUNTRIES.map((c) => (
          <li key={c.iso2} className="bg-card">
            <Link to="/countries/$code/tenders" params={{ code: c.iso2 }} className="block p-4 hover:bg-secondary">
              <span className="font-medium">{c.name}</span>
              <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{c.sources.map((s) => SOURCES[s].label).join(" · ")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  ),
});
