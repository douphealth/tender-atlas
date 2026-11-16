import { createFileRoute, Link } from "@tanstack/react-router";
import { getBuyers } from "@/lib/directory";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/buyers/")({
  loader: () => getBuyers(),
  head: () => pageHead({ title: "Public buyers and contracting authorities", description: "Explore public-sector buyers, their active opportunities, procurement categories and official notices.", path: "/buyers" }),
  component: BuyersPage,
});

function BuyersPage() {
  const { items, storage } = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="eyebrow">Buyer intelligence</p>
      <h1 className="mt-1 text-4xl font-semibold">Who buys what?</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">Contracting authorities ranked by the notices currently visible to TenderAtlas. Counts reflect {storage === "database" ? "the stored official-notice archive" : "the latest live publisher response; configure the archive for history"}.</p>
      {items.length ? <ol className="mt-8 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {items.map((buyer, index) => <li key={buyer.slug} className="bg-card">
          <Link to="/buyers/$slug" params={{ slug: buyer.slug }} className="block h-full p-5 transition hover:bg-secondary">
            <span className="font-mono text-xs text-accent">{String(index + 1).padStart(2, "0")}</span>
            <span className="mt-2 block font-medium leading-snug">{buyer.name}</span>
            <span className="mt-3 block font-mono text-xs text-muted-foreground">{buyer.open} open · {buyer.count} notice{buyer.count === 1 ? "" : "s"}</span>
          </Link>
        </li>)}
      </ol> : <p className="mt-8 rounded-md border border-dashed border-border p-8 text-muted-foreground">No buyer records were returned just now. Try the live tender search.</p>}
    </div>
  );
}
