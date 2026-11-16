import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { searchTenders } from "@/lib/procurement/api";
import { countryBySlug, SOURCES } from "@/lib/procurement/catalog";
import { SourceHealth, TenderList } from "@/components/atlas/TenderList";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/countries/$code/tenders")({
  loader: async ({ params }) => {
    const c = countryBySlug(params.code);
    if (!c || c.iso2 !== params.code) throw notFound();
    const result = await searchTenders({ data: { country: c.iso3, days: 30, only: c.sources } });
    return { country: c, result };
  },
  head: ({ loaderData, params }) => loaderData
    ? pageHead({
        title: `Public tenders in ${loaderData.country.name}`,
        description: `Open public procurement notices in ${loaderData.country.name} published in the last 30 days, from ${loaderData.country.sources.map((s) => SOURCES[s].label).join(", ")}.`,
        path: `/countries/${loaderData.country.iso2}/tenders`,
        noindex: loaderData.result.items.length < 5,
      })
    : pageHead({ title: "Country not covered", description: "This country has no TenderAtlas directory page.", path: `/countries/${params.code}/tenders`, noindex: true }),
  component: CountryPage,
});

function CountryPage() {
  const { country, result } = Route.useLoaderData();
  const open = result.items.filter((n) => n.status === "open");
  const buyers = new Map<string, number>();
  for (const n of result.items) if (n.buyer) buyers.set(n.buyer, (buyers.get(n.buyer) ?? 0) + 1);
  const top = [...buyers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="text-sm text-muted-foreground"><Link to="/countries" className="hover:text-accent">Countries</Link> / {country.name}</nav>
      <h1 className="mt-2 text-4xl font-semibold">Public tenders in {country.name}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        {result.items.length} notices published in the last 30 days were returned by {country.sources.map((s) => SOURCES[s].label).join(" and ")}; {open.length} still list a future deadline.
      </p>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-3"><TenderList items={result.items} /><SourceHealth result={result} /></div>
        {top.length > 0 && (
          <aside className="rounded-md border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Most active buyers</h2>
            <ol className="mt-3 space-y-2 text-sm">{top.map(([b, c]) => <li key={b} className="flex justify-between gap-2"><span className="truncate">{b}</span><span className="font-mono text-muted-foreground">{c}</span></li>)}</ol>
            <p className="mt-3 text-xs text-muted-foreground">Counted from the notices on this page only.</p>
          </aside>
        )}
      </div>
    </div>
  );
}
