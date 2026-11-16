import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getBuyer } from "@/lib/directory";
import { TenderList } from "@/components/atlas/TenderList";
import { cpvDivision } from "@/lib/procurement/catalog";
import { fmtMoney } from "@/components/atlas/format";
import { pageHead } from "@/lib/seo";
import { abs } from "@/lib/site";

export const Route = createFileRoute("/buyers/$slug")({
  loader: async ({ params }) => {
    const result = await getBuyer({ data: params });
    if (!result.profile) throw notFound();
    return result;
  },
  head: ({ loaderData, params }) => loaderData?.profile ? pageHead({
    title: `${loaderData.profile.name} tenders and procurement history`,
    description: `${loaderData.profile.open} open opportunities and ${loaderData.profile.count} official notices from ${loaderData.profile.name}. Explore categories, deadlines and source records.`,
    path: `/buyers/${loaderData.profile.slug}`,
    noindex: loaderData.profile.count < 2,
    jsonLd: { "@context": "https://schema.org", "@type": "GovernmentOrganization", name: loaderData.profile.name, url: abs(`/buyers/${loaderData.profile.slug}`) },
  }) : pageHead({ title: "Buyer not found", description: "This buyer is not present in the current official-notice coverage.", path: `/buyers/${params.slug}`, noindex: true }),
  component: BuyerPage,
  notFoundComponent: () => <div className="mx-auto max-w-2xl px-4 py-24 text-center"><h1 className="text-3xl font-semibold">Buyer not found</h1><p className="mt-3 text-muted-foreground">This buyer is outside the current archive or live coverage.</p><Link to="/buyers" className="mt-5 inline-block text-accent underline">Browse buyers</Link></div>,
});

function BuyerPage() {
  const { profile: b, storage } = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="text-sm text-muted-foreground"><Link to="/buyers" className="hover:text-accent">Buyers</Link> / {b.name}</nav>
      <p className="eyebrow mt-8">Contracting authority</p>
      <h1 className="mt-2 max-w-4xl text-4xl font-semibold leading-tight">{b.name}</h1>
      <dl className="mt-8 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
        {[["Open now", b.open], ["Notices in coverage", b.count], ["Countries", b.countries], ["Disclosed value", b.disclosedValueEur != null ? `≈ ${fmtMoney(b.disclosedValueEur, "EUR")}` : "Not disclosed"]].map(([label, value]) => <div key={String(label)} className="bg-card p-5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-xl">{value}</dd></div>)}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">Coverage: {storage === "database" ? "stored official notices" : "latest live results only"}. Disclosed value sums only records with an amount and an available ECB conversion; it is not total buyer spend.</p>
      {b.categories.length > 0 && <section className="mt-10"><h2 className="text-2xl font-semibold">Main procurement categories</h2><ul className="mt-4 flex flex-wrap gap-2">{b.categories.map((c) => <li key={c.code}><Link to="/cpv/$code" params={{ code: c.code }} className="rounded-sm border border-border bg-card px-3 py-2 text-sm hover:bg-secondary">{cpvDivision(c.code)?.name ?? c.code} <span className="font-mono text-xs text-muted-foreground">{c.count}</span></Link></li>)}</ul></section>}
      <section className="mt-10"><h2 className="text-2xl font-semibold">Official notices</h2><div className="mt-4"><TenderList items={b.notices} /></div></section>
    </div>
  );
}
