import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { searchTenders } from "@/lib/procurement/api";
import { COUNTRIES, cpvDivision } from "@/lib/procurement/catalog";
import { SourceHealth, TenderList } from "@/components/atlas/TenderList";
import { pageHead } from "@/lib/seo";
import { CpvInsights } from "@/components/atlas/CpvInsights";

export const Route = createFileRoute("/cpv/$code")({
  loader: async ({ params }) => {
    const division = cpvDivision(params.code);
    if (!division) throw notFound(); // only the 45 official divisions get pages
    const result = await searchTenders({ data: { cpv: division.code, days: 30, only: ["ted", "fr", "gr", "uk"] } });
    return { division, result };
  },
  head: ({ loaderData, params }) => loaderData
    ? pageHead({
        title: `CPV code ${loaderData.division.code}: ${loaderData.division.name} tenders`,
        description: `What CPV ${loaderData.division.code} covers, plus live ${loaderData.division.name.toLowerCase()} tenders from TED, Find a Tender, BOAMP and KIMDIS: open notices, values, countries and top buyers.`,
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
      <h1 className="mt-2 text-4xl font-semibold">CPV {division.code}: {division.name}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">Notices from TED, BOAMP, KIMDIS and Find a Tender whose CPV classification falls in division {division.code.slice(0, 2)}, published in the last 30 days.</p>
      <CpvInsights division={division} items={result.items} />
      <div className="mt-8 space-y-3"><TenderList items={result.items} /><SourceHealth result={result} /></div>
      <section className="mt-12"><h2 className="text-2xl font-semibold">{division.name} by country</h2><ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">{COUNTRIES.filter((c) => c.iso3 !== "USA").map((c) => <li key={c.iso2}><Link to="/countries/$code/cpv/$cpv" params={{ code: c.iso2, cpv: division.code }} className="hover:text-accent">{c.name}</Link></li>)}</ul></section>
    </div>
  );
}
