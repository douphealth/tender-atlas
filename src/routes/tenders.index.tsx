import { createFileRoute, Link } from "@tanstack/react-router";
import { searchTenders } from "@/lib/procurement/api";
import { SearchForm, type TenderSearch } from "@/components/atlas/SearchForm";
import { SourceHealth, TenderList } from "@/components/atlas/TenderList";
import { AlertForm } from "@/components/atlas/AlertForm";
import { itemList, jsonLd, pageHead } from "@/lib/seo";
import { useWorkspace } from "@/lib/workspace";

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 100) : undefined);
const amount = (v: unknown) => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1e12 && v !== "" && v != null ? Number(v) : undefined;
export const Route = createFileRoute("/tenders/")({
  validateSearch: (s: Record<string, unknown>): TenderSearch => ({
    q: str(s["q"]), source: str(s["source"]), country: str(s["country"]), cpv: str(s["cpv"]),
    days: [7, 14, 60, 90].includes(Number(s["days"])) ? Number(s["days"]) : undefined,
    page: Number(s["page"]) > 1 ? Math.min(1000, Math.floor(Number(s["page"]))) : undefined,
    deadline: s["deadline"] === "48h" || s["deadline"] === "7d" ? s["deadline"] : undefined,
    minValueEur: amount(s["minValueEur"]), maxValueEur: amount(s["maxValueEur"]),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => searchTenders({ data: { ...deps } }),
  head: ({ match, loaderData }) => {
    const filtered = Object.values(match.search ?? {}).some((v) => v !== undefined);
    const items = loaderData?.items ?? [];
    return pageHead({
      title: "Search public tenders",
      description: "Search open public procurement notices across TED, BOAMP, KIMDIS, Find a Tender, World Bank and SAM.gov by keyword, country, CPV, deadline and value.",
      path: "/tenders",
      noindex: filtered,
      jsonLd: filtered || !items.length ? undefined : jsonLd([itemList("Public tenders", items.map((n) => ({ name: n.title, path: `/tenders/${n.source}/${encodeURIComponent(n.noticeId)}` })))]),
    });
  },
  component: TendersPage,
});

function TendersPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const ws = useWorkspace();
  const page = search.page ?? 1;
  const feedQuery = new URLSearchParams(Object.fromEntries(Object.entries(search).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Official-source intelligence</p><h1 className="mt-1 text-4xl font-semibold">Public tenders</h1></div><a href={`/tenders.rss${feedQuery ? `?${feedQuery}` : ""}`} className="rounded-sm border border-border px-3 py-2 text-sm hover:bg-secondary">RSS feed</a></div>
      <p className="mt-3 max-w-2xl text-muted-foreground">Search live notices from TED, BOAMP, KIMDIS, Find a Tender, World Bank and SAM.gov. Every result links to the official publisher record.</p>
      <div className="mt-6"><SearchForm key={JSON.stringify(search)} initial={search} /></div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <SourceHealth result={data} />
        {ws.ready && <button onClick={() => ws.saveSearch(search.q || "All tenders", Object.fromEntries(Object.entries(search).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])))} className="rounded-sm border border-border px-3 py-1.5 hover:bg-secondary">Save this search</button>}
      </div>
      <div className="mt-6 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{data.total != null ? `${data.total.toLocaleString()} matching notices in current coverage` : `${data.items.length} notices returned`}</p>{page > 1 && <p className="font-mono text-xs">Page {page}</p>}</div>
      <div className="mt-3"><TenderList items={data.items} /></div>
      <nav className="mt-6 flex justify-between text-sm" aria-label="Pagination">
        {page > 1 ? <Link to="/tenders" search={{ ...search, page: page - 1 > 1 ? page - 1 : undefined }} className="rounded-sm border border-border px-4 py-2 hover:bg-secondary">← Previous</Link> : <span />}
        {(data.hasNext ?? (page < 1000 && data.items.length > 0)) && <Link to="/tenders" search={{ ...search, page: page + 1 }} className="rounded-sm border border-border px-4 py-2 hover:bg-secondary">Next page →</Link>}
      </nav>
      <AlertForm query={search} />
    </div>
  );
}
