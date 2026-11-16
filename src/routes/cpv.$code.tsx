import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { searchTenders } from "@/lib/procurement/api";
import { COUNTRIES, cpvDivision } from "@/lib/procurement/catalog";
import { SourceHealth, TenderList } from "@/components/atlas/TenderList";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/cpv/$code")({
  loader: async ({ params }) => {
    const division = cpvDivision(params.code);
    if (!division) throw notFound(); // only the 45 official divisions get pages
    const result = await searchTenders({ data: { cpv: division.code, days: 30, only: ["ted", "fr", "gr", "uk"] } });
    return { division, result };
  },
  head: ({ loaderData, params }) => loaderData
    ? pageHead({
        title: `${loaderData.division.name} tenders (CPV ${loaderData.division.code.slice(0, 2)})`,
        description: `Public tenders classified under CPV ${loaderData.division.code} — ${loaderData.division.name} — published in the last 30 days across Europe.`,
        path: `/cpv/${loaderData.division.code}`,
        noindex: loaderData.result.items.length < 5,
      })
    : pageHead({ title: "Unknown CPV division", description: "Not a CPV division.", path: `/cpv/${params.code}`, noindex: true }),
  component: CpvPage,
});

function CpvPage() {
  const { division, result } = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="text-sm text-muted-foreground"><Link to="/cpv" className="hover:text-accent">Categories</Link> / CPV {division.code}</nav>
      <h1 className="mt-2 text-4xl font-semibold">{division.name}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">Notices from TED and BOAMP whose CPV classification falls in division {division.code.slice(0, 2)}, published in the last 30 days.</p>
      <div className="mt-8 space-y-3"><TenderList items={result.items} /><SourceHealth result={result} /></div>
      <section className="mt-12"><h2 className="text-2xl font-semibold">{division.name} by country</h2><ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">{COUNTRIES.filter((c) => c.iso3 !== "USA").map((c) => <li key={c.iso2}><Link to="/countries/$code/cpv/$cpv" params={{ code: c.iso2, cpv: division.code }} className="hover:text-accent">{c.name}</Link></li>)}</ul></section>
    </div>
  );
}
