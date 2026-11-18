export const DOSSIER_OFFER = {
  version: "pilot-2026-11-v1",
  amount: 29000,
  currency: "eur",
  deliveryWorkingDays: 2,
  scope: "One tender, one lot, up to 150 pages of accessible official documents",
  delivery: "Within two working days after payment and access to the complete official documents. Monday–Friday, excluding Greek public holidays.",
  refund: "Full refund if we cannot access the required documents or deliver the agreed scope. If the tender exceeds the pilot scope, we ask for approval before any extra work; otherwise we refund in full.",
  deliverables: [
    ["Decision brief", "Bid / no-bid / clarification needed, with evidence and unresolved blockers—not a win prediction."],
    ["Eligibility matrix", "Exclusion grounds, turnover, references, certificates and consortium rules, with document, page and section citations."],
    ["Submission checklist", "Files, signatures, portal steps, lot rules and the publisher’s deadline and time zone; omissions marked not disclosed."],
    ["Risk & clarification register", "Prioritised disqualification risks, conflicting clauses, clarification questions and who needs to resolve them."],
    ["Evidence pack", "PDF dossier and editable checklist, document/version manifest, amendments reviewed and an explicit unknowns register."],
  ],
} as const;

export type DossierAvailability = { available: boolean; reason?: string; amount?: number; currency?: string };

export function validDossierPrice(price: { id?: string; active?: boolean; type?: string; currency?: string; unit_amount?: number; recurring?: unknown; tax_behavior?: string }, priceId: string, automaticTax = true): boolean {
  // With Stripe Tax on, tax is added on top so the price must exclude tax; without it the flat price is the total.
  return price.id === priceId && price.active === true && price.type === "one_time" && !price.recurring && price.currency === DOSSIER_OFFER.currency && price.unit_amount === DOSSIER_OFFER.amount && (!automaticTax || price.tax_behavior === "exclusive");
}