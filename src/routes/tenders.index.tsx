import { createFileRoute, Link } from "@tanstack/react-router";
import { searchTenders } from "@/lib/procurement/api";
import { SearchForm, type TenderSearch } from "@/components/atlas/SearchForm";
import { SourceHealth, TenderList } from "@/components/atlas/TenderList";
import { pageHead } from "@/lib/seo";
import { useWorkspace } from "@/lib/workspace";

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 100) : undefined);
export const Route = createFileRoute("/tenders/")({
  validateSearch: (s: Record<string, unknown>): TenderSearch => ({
    q: str(s["q"]), source: str(s["source"]), country: str(s["country"]), cpv: str(s["cpv"]),
    days: [7, 14, 60, 90].includes(Number(s["days"])) ? Number(s["days"]) : undefined,
    page: Number(s["page"]) > 1 ? Math.min(4, Math.floor(Number(s["page"]))) : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => searchTenders({ data: { ...deps } }),
  head: ({ match }) => {
    const filtered = Object.values(match.search ?? {}).some((v) => v !== undefined);
    return pageHead({
      title: "Search public tenders",
      description: "Search open public procurement notices across TED, BOAMP, KIMDIS, Find a Tender, World Bank and SAM.gov by keyword, country and CPV code.",
      path: "/tenders",
      noindex: filtered, // faceted URLs are not indexed; the canonical stays /tenders
    });
  },
  component: TendersPage,
});

function TendersPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const ws = useWorkspace();
  const page = search.page ?? 1;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="eyebrow">Live search</p>
      <h1 className="mt-1 text-4xl font-semibold">Public tenders</h1>
      <div className="mt-6"><SearchForm key={JSON.stringify(search)} initial={search} /></div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <SourceHealth result={data} />
        {ws.ready && (
          <button
            onClick={() => ws.saveSearch(search.q || "All tenders", Object.fromEntries(Object.entries(search).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])))}
            className="rounded-sm border border-border px-3 py-1.5 hover:bg-secondary"
          >Save this search</button>
        )}
      </div>
      <div className="mt-6"><TenderList items={data.items} /></div>
      <nav className="mt-6 flex justify-between text-sm" aria-label="Pagination">
        {page > 1 ? <Link to="/tenders" search={{ ...search, page: page - 1 > 1 ? page - 1 : undefined }} className="hover:text-accent">← Previous</Link> : <span />}
        {page < 4 && data.items.length > 0 && <Link to="/tenders" search={{ ...search, page: page + 1 }} className="hover:text-accent">Next page →</Link>}
      </nav>
    </div>
  );
}
