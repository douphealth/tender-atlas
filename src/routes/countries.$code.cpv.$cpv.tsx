import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { searchTenders } from "@/lib/procurement/api";
import { countryBySlug, cpvDivision, SOURCES } from "@/lib/procurement/catalog";
import { SourceHealth, TenderList } from "@/components/atlas/TenderList";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/countries/$code/cpv/$cpv")({
  loader: async ({ params }) => {
    const country = countryBySlug(params.code);
    const division = cpvDivision(params.cpv);
    if (!country || country.iso2 !== params.code || !division) throw notFound();
    const sources = country.sources.filter((s) => s === "ted" || s === "fr" || s === "gr" || s === "uk");
    const result = await searchTenders({ data: { country: country.iso3, cpv: division.code, days: 30, only: sources } });
    return { country, division, result };
  },
  head: ({ loaderData, params }) => loaderData ? pageHead({
    title: `${loaderData.division.name} tenders in ${loaderData.country.name}`,
    description: `${loaderData.division.name} public tenders in ${loaderData.country.name}: CPV ${loaderData.division.code}, official notices, buyers and deadlines.`,
    path: `/countries/${loaderData.country.iso2}/cpv/${loaderData.division.code}`,
    noindex: loaderData.result.items.length < 5,
  }) : pageHead({ title: "Tender category not found", description: "This country and CPV combination is not covered.", path: `/countries/${params.code}/cpv/${params.cpv}`, noindex: true }),
  component: CountryCpvPage,
});

function CountryCpvPage() {
  const { country, division, result } = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="text-sm text-muted-foreground"><Link to="/countries/$code/tenders" params={{ code: country.iso2 }} className="hover:text-accent">{country.name}</Link> / <Link to="/cpv/$code" params={{ code: division.code }} className="hover:text-accent">CPV {division.code.slice(0, 2)}</Link></nav>
      <p className="eyebrow mt-8">{country.name} · CPV {division.code}</p>
      <h1 className="mt-2 max-w-4xl text-4xl font-semibold leading-tight">{division.name} tenders in {country.name}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">Official notices published in the last 30 days by {country.sources.map((s) => SOURCES[s].label).join(" and ")}, classified in CPV division {division.code.slice(0, 2)}. Missing classifications are never guessed.</p>
      <div className="mt-8 space-y-3"><TenderList items={result.items} /><SourceHealth result={result} /></div>
    </div>
  );
}
