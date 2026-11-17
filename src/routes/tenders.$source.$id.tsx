import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getTender } from "@/lib/procurement/api";
import { SOURCES, countryByIso3, cpvDivisionFor } from "@/lib/procurement/catalog";
import { isIndexable, makeIcs, unknowns } from "@/lib/procurement/sources";
import { StatusPill } from "@/components/atlas/TenderList";
import { fmtDate, fmtMoney } from "@/components/atlas/format";
import { breadcrumbList, jsonLd, pageHead } from "@/lib/seo";
import { abs } from "@/lib/site";
import { useWorkspace } from "@/lib/workspace";
import { buyerSlug } from "@/lib/procurement/reconcile";
import { DossierOrder } from "@/components/atlas/DossierOrder";

export const Route = createFileRoute("/tenders/$source/$id")({
  loader: async ({ params }) => {
    const n = await getTender({ data: params });
    if (!n) throw notFound();
    return n;
  },
  head: ({ loaderData: n, params }) => {
    if (!n) return pageHead({ title: "Tender not found", description: "This notice could not be found at its official source.", path: `/tenders/${params.source}/${params.id}`, noindex: true, canonical: false });
    const where = countryByIso3(n.country)?.name ?? n.countryName;
    const path = `/tenders/${n.source}/${encodeURIComponent(n.noticeId)}`;
    return pageHead({
      title: n.title,
      description: `${n.buyer ?? "Public buyer"}${where ? `, ${where}` : ""}. ${n.deadlineAt ? `Deadline ${n.deadlineAt}. ` : ""}Official ${SOURCES[n.source].label} notice ${n.noticeId}.`,
      path,
      image: abs(`/og/tenders/${n.source}/${encodeURIComponent(n.noticeId)}.png`),
      noindex: !isIndexable(n),
      jsonLd: jsonLd([
        { "@type": "Demand", name: n.title, description: n.description ?? undefined, url: abs(path),
          datePosted: n.publishedAt ?? undefined, validThrough: n.deadlineAt ?? undefined,
          seller: n.buyer ? { "@type": "GovernmentOrganization", name: n.buyer, url: abs(`/buyers/${buyerSlug(n.buyer)}`) } : undefined,
          itemOffered: { "@type": "Service", name: n.title, category: n.cpv.map((c) => `CPV ${c}`) },
          eligibleRegion: where ? { "@type": "Country", name: where } : undefined,
          priceSpecification: n.value != null && n.currency ? { "@type": "PriceSpecification", price: n.value, priceCurrency: n.currency } : undefined,
        },
        breadcrumbList([
          { name: "Tenders", path: "/tenders" },
          { name: n.title, path },
        ]),
      ]),
    });
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold">Notice not found</h1>
      <p className="mt-3 text-muted-foreground">The official publisher did not return this notice. It may have been withdrawn or the reference is wrong.</p>
      <Link to="/tenders" className="mt-6 inline-block text-accent underline">Search tenders</Link>
    </div>
  ),
  component: TenderPage,
});

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="grid grid-cols-[9rem_1fr] gap-3 border-b border-border py-2.5 text-sm last:border-0"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>;
}

function TenderPage() {
  const n = Route.useLoaderData();
  const ws = useWorkspace();
  const country = countryByIso3(n.country);
  const div = n.cpv[0] ? cpvDivisionFor(n.cpv[0]) : undefined;
  const ics = () => {
    if (!n.deadlineAt) return;
    const url = URL.createObjectURL(new Blob([makeIcs({ ...n, deadlineAt: n.deadlineAt })], { type: "text/calendar" }));
    Object.assign(document.createElement("a"), { href: url, download: `deadline-${n.noticeId}.ics` }).click();
    URL.revokeObjectURL(url);
  };
  return (
    <article className="mx-auto max-w-6xl px-4 py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/tenders" className="hover:text-accent">Tenders</Link> / {SOURCES[n.source].label}
        {country && <> / <Link to="/countries/$code/tenders" params={{ code: country.iso2 }} className="hover:text-accent">{country.name}</Link></>}
      </nav>
      <div className="mt-4 flex flex-wrap items-center gap-3"><StatusPill n={n} /><span className="font-mono text-xs text-muted-foreground">{n.noticeId}</span></div>
      <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight sm:text-4xl">{n.title}</h1>
      <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
        Official {SOURCES[n.source].name} notice {n.noticeId}{country ? ` in ${country.name}` : n.countryName ? ` in ${n.countryName}` : ""}. Buyer: {n.buyer ? <Link to="/buyers/$slug" params={{ slug: buyerSlug(n.buyer) }} className="hover:text-accent hover:underline">{n.buyer}</Link> : "not disclosed"}. {n.deadlineAt ? <>Deadline: {fmtDate(n.deadlineAt)}.</> : "Deadline: not disclosed."} Confirm the record on the official notice before bidding.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {n.url && <a href={n.url} target="_blank" rel="noopener noreferrer" className="rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">Open official notice ↗</a>}
        {ws.ready && <button onClick={() => ws.toggle(n)} className="rounded-sm border border-border px-4 py-2 text-sm hover:bg-secondary">{ws.isSaved(n.id) ? "Saved ✓" : "Save to workspace"}</button>}
        {n.deadlineAt && <button onClick={ics} className="rounded-sm border border-border px-4 py-2 text-sm hover:bg-secondary">Add deadline to calendar</button>}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div>
          <h2 className="text-xl font-semibold">Notice record</h2>
          <dl className="mt-3 rounded-md border border-border bg-card px-4">
            <Row k="Buyer" v={n.buyer ?? "—"} />
            <Row k="Country" v={country?.name ?? n.countryName ?? n.country ?? "—"} />
            <Row k="Published" v={fmtDate(n.publishedAt)} />
            <Row k="Deadline" v={n.deadlineAt ? <>{fmtDate(n.deadlineAt)} <span className="text-muted-foreground">({n.deadlineKind === "request" ? "requests to participate" : "tenders"}{n.deadlineTimezone ? `, ${n.deadlineTimezone}` : ""}{n.deadlineBasis ? `; ${n.deadlineBasis}` : ""})</span></> : "Not disclosed"} />
            <Row k="Estimated value" v={n.value != null ? <>{fmtMoney(n.value, n.currency)}{n.valueEur != null && n.currency !== "EUR" && <span className="block text-xs text-muted-foreground">Approximately {fmtMoney(n.valueEur, "EUR")} using the ECB reference rate; indicative only.</span>}</> : "Not disclosed"} />
            <Row k="Procedure" v={n.procedure ?? "—"} />
            <Row k="Notice type" v={n.noticeType ?? "—"} />
            <Row k="CPV" v={n.cpv.length ? <span className="flex flex-wrap gap-1.5">{n.cpv.map((c) => <Link key={c} to="/cpv/$code" params={{ code: `${c.slice(0, 2)}000000` }} className="rounded-sm bg-secondary px-1.5 font-mono text-xs hover:text-accent" title={cpvDivisionFor(c)?.name}>{c}</Link>)}</span> : "—"} />
          </dl>
          {n.description && (<><h2 className="mt-8 text-xl font-semibold">Description (from the publisher)</h2><p className="mt-3 whitespace-pre-line leading-relaxed">{n.description}</p></>)}
          {n.documents.length > 0 && (<><h2 className="mt-8 text-xl font-semibold">Document manifest</h2><p className="mt-1 text-xs text-muted-foreground">Publisher-disclosed links. Files are not mirrored; access requirements and integrity remain controlled by the publisher.</p><ul className="mt-3 space-y-2 text-sm">{n.documents.map((d) => <li key={d.url} className="rounded-sm border border-border p-3"><a href={d.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">{d.label} ↗</a></li>)}</ul></>)}
          {n.relatedNotices && n.relatedNotices.length > 0 && (<><h2 className="mt-8 text-xl font-semibold">Matched official register records</h2><p className="mt-1 text-sm text-muted-foreground">These records matched exactly on buyer, title, country and deadline. Review each official version.</p><ul className="mt-3 space-y-2">{n.relatedNotices.map((r) => <li key={`${r.source}:${r.noticeId}`}><Link to="/tenders/$source/$id" params={{ source: r.source, id: r.noticeId }} className="text-accent underline">{SOURCES[r.source].label} · {r.noticeId}</Link>{r.url && <> · <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground underline">official record ↗</a></>}</li>)}</ul></>)}
        </div>
        <aside className="space-y-6">
          <DossierOrder key={n.id} notice={n} />
          <div className="rounded-md border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Not in the record</h2>
            <p className="mt-1 text-xs text-muted-foreground">We list what is missing rather than guess it.</p>
            <ul className="mt-3 space-y-2 text-sm">{unknowns(n).map((u) => <li key={u} className="border-l-2 border-warning pl-2">{u}</li>)}</ul>
          </div>
          <figure><img src={`/og/tenders/${n.source}/${encodeURIComponent(n.noticeId)}.png`} width="1200" height="630" loading="lazy" alt={`TenderAtlas share card for ${n.title}`} className="aspect-[1200/630] w-full rounded-md border border-border object-cover" /><figcaption className="mt-1 text-[11px] text-muted-foreground">Share preview · 1200 × 630</figcaption></figure>
          <p className="font-mono text-[11px] text-muted-foreground">Source: {n.provenance}. Retrieved {n.fetchedAt.slice(0, 16).replace("T", " ")} UTC.{div ? ` Category: ${div.name}.` : ""}</p>
        </aside>
      </div>
    </article>
  );
}
