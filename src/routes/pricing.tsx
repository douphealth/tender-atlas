import { createFileRoute, Link } from "@tanstack/react-router";
import { jsonLd, pageHead } from "@/lib/seo";
import { DossierForm } from "@/components/atlas/DossierForm";
import { SampleDossier } from "@/components/atlas/SampleDossier";
import { DossierConfirmation } from "@/components/atlas/DossierConfirmation";
import { DOSSIER_OFFER } from "@/lib/dossier/offer";
import { isSourceKey } from "@/lib/procurement/catalog";
import { z } from "zod";
import { abs } from "@/lib/site";

export const Route = createFileRoute("/pricing")({
  validateSearch: (search: Record<string, unknown>): { source?: string; notice?: string; order?: string; payment?: string } => ({
    ...(typeof search["source"] === "string" && isSourceKey(search["source"]) ? { source: search["source"] } : {}),
    ...(typeof search["notice"] === "string" ? { notice: search["notice"].slice(0, 160) } : {}),
    ...(typeof search["order"] === "string" && z.string().uuid().safeParse(search["order"]).success ? { order: search["order"] } : {}),
    ...(search["payment"] === "returned" || search["payment"] === "cancelled" ? { payment: search["payment"] } : {}),
  }),
  head: ({ match }) => {
    const search = match.search;
    const utility = Boolean(search.order || search.payment || search.source || search.notice);
    const description = "Document-backed bid/no-bid dossiers: requirements, risks and open questions, each cited to the official tender documents.";
    return pageHead({
      title: "Tender Readiness Dossiers",
      description,
      path: "/pricing",
      noindex: utility,
      jsonLd: utility ? undefined : jsonLd([{
        "@type": "Service",
        name: "Tender Readiness Dossier",
        serviceType: "Document-backed bid/no-bid review",
        description: DOSSIER_OFFER.scope,
        url: abs("/pricing"),
        provider: { "@type": "Organization", name: "TenderAtlas", url: abs("/") },
        offers: { "@type": "Offer", price: "290", priceCurrency: "EUR", url: abs("/pricing"), description: "One-off, plus applicable tax. No subscription." },
      }]),
    });
  },
  component: Pricing,
});

function Pricing() {
  const search = Route.useSearch();
  const tenderPath = search.source && search.notice ? `/tenders/${search.source}/${encodeURIComponent(search.notice)}` : "";
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {search.order && <DossierConfirmation orderId={search.order} cancelled={search.payment === "cancelled"} />}
      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <p className="eyebrow">Pilot programme</p>
          <h1 className="mt-1 text-4xl font-semibold">Tender Readiness Dossiers</h1>
          <p className="mt-4 text-lg text-muted-foreground">A document-backed bid decision: requirements traced to their page, disqualification risks prioritised, and missing evidence made explicit.</p>
          <p className="mt-6"><span className="font-mono text-3xl font-semibold">€290</span> <span className="text-sm text-muted-foreground">one-off, plus applicable tax · no subscription</span></p>
          <p className="mt-2 text-sm text-muted-foreground">{DOSSIER_OFFER.scope}.</p>
          <ul className="mt-8 space-y-4">{DOSSIER_OFFER.deliverables.map(([title, detail]) => <li key={title} className="border-l-2 border-accent pl-3"><h2 className="font-sans text-sm font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{detail}</p></li>)}</ul>
          <p className="mt-8 text-sm text-muted-foreground">{DOSSIER_OFFER.delivery}</p>
          <p className="mt-3 text-sm text-muted-foreground">{DOSSIER_OFFER.refund}</p>
          <p className="mt-3 text-xs text-muted-foreground">No legal advice, bid drafting, translation, continuous monitoring or guarantee of qualification or award. Paid bookings open only when delivery capacity is confirmed. Urgent, closed or undisclosed-deadline tenders need a scope review first.</p>
          <Link to="/tenders" className="mt-5 inline-block text-sm text-accent underline">Choose a tender to order its dossier →</Link>
        </div>
        <DossierForm key={tenderPath} notice={tenderPath ? abs(tenderPath) : ""} />
      </div>
      <SampleDossier />
    </div>
  );
}
