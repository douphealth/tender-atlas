import { createFileRoute, Link } from "@tanstack/react-router";
import { searchTenders } from "@/lib/procurement/api";
import { COUNTRIES, CPV_DIVISIONS, SOURCES, SOURCE_KEYS } from "@/lib/procurement/catalog";
import { TenderList, SourceHealth } from "@/components/atlas/TenderList";
import { SearchForm } from "@/components/atlas/SearchForm";
import { pageHead } from "@/lib/seo";
import { abs } from "@/lib/site";

export const Route = createFileRoute("/")({
  loader: () => searchTenders({ data: { days: 7, only: ["ted", "fr", "wb"] } }),
  head: () => pageHead({
    title: "TenderAtlas — Live public tenders from official procurement sources",
    description: "Find open public tenders across Europe, the UK, France, Greece, the US and World Bank projects. Every notice links to its official publisher.",
    path: "/",
    jsonLd: { "@context": "https://schema.org", "@type": "WebSite", name: "TenderAtlas", url: abs("/"), potentialAction: { "@type": "SearchAction", target: abs("/tenders?q={q}"), "query-input": "required name=q" } },
  }),
  component: Home,
});

const POPULAR_CPV = ["45000000", "72000000", "33000000", "71000000", "90000000", "79000000", "48000000", "34000000"];

function Home() {
  const data = Route.useLoaderData();
  const open = data.items.filter((n) => n.status === "open").slice(0, 12);
  return (
    <>
      <section className="grid-paper border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="eyebrow">Public procurement · read at source</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] text-primary sm:text-6xl">
            Every public tender, traced back to the <em className="text-accent">official notice</em>.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            TenderAtlas queries {SOURCE_KEYS.length} government and multilateral publishers live. No scraped copies, no invented eligibility — just the record and a link to the original.
          </p>
          <div className="mt-8 max-w-3xl"><SearchForm compact /></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Published in the last 7 days</p>
            <h2 className="mt-1 text-3xl font-semibold">Open for bids now</h2>
          </div>
          <Link to="/tenders" className="text-sm font-medium text-accent hover:underline">Search all tenders →</Link>
        </div>
        <div className="mt-6 space-y-3">
          <TenderList items={open} empty="No publisher responded just now. Try the full search." />
          <SourceHealth result={data} />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-6 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold">Tenders by country</h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
            {COUNTRIES.map((c) => (
              <li key={c.iso2}><Link to="/countries/$code/tenders" params={{ code: c.iso2 }} className="hover:text-accent">{c.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Popular categories</h2>
          <ul className="mt-4 space-y-1.5 text-sm">
            {POPULAR_CPV.map((code) => {
              const d = CPV_DIVISIONS.find((x) => x.code === code)!;
              return <li key={code}><Link to="/cpv/$code" params={{ code }} className="hover:text-accent"><span className="font-mono text-muted-foreground">{code.slice(0, 2)}</span> {d.name}</Link></li>;
            })}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-semibold">Sources we read</h2>
        <dl className="mt-6 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3">
          {SOURCE_KEYS.map((k) => (
            <div key={k} className="bg-card p-5">
              <dt className="font-mono text-xs text-accent">{SOURCES[k].label}</dt>
              <dd className="mt-1 text-sm font-medium">{SOURCES[k].name}</dd>
              <dd className="text-xs text-muted-foreground">{SOURCES[k].region}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">Coverage is live and bounded, not a complete archive. <Link to="/methodology" className="underline">Read the methodology</Link>.</p>
      </section>
    </>
  );
}
