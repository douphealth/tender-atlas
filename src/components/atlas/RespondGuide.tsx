import type { SourceKey } from "@/lib/procurement/catalog";

// Publisher-level procedure notes: how responses are normally made for notices from each source.
// Deliberately general and stable. Tender-specific rules always come from the official documents.
const GUIDES: Record<SourceKey, { title: string; steps: string[] }> = {
  ted: {
    title: "Responding to an EU (TED) tender",
    steps: [
      "Open the official notice and find the address of the procurement documents. TED publishes the notice; the documents and the submission portal belong to the buyer.",
      "Register on the e-procurement platform named in the notice. Most EU buyers accept electronic submissions only.",
      "Prepare the European Single Procurement Document (ESPD) where the buyer requests it, plus the evidence it refers to (exclusion grounds, financial standing, technical capacity).",
      "Check the lot structure, the time limit for receipt of tenders and the language requirements before you start writing.",
      "Send clarification questions through the buyer's platform before its question deadline; answers are usually shared with every bidder.",
    ],
  },
  fr: {
    title: "Responding to a French (BOAMP) tender",
    steps: [
      "Download the consultation file (DCE) from the buyer's profile (profil d'acheteur) linked in the official notice.",
      "Read the règlement de la consultation (RC) first: it sets the lots, award criteria, required documents and submission deadline.",
      "Prepare the candidature, usually the DUME or the DC1/DC2 forms, and the offer documents the RC lists.",
      "Submit electronically on the buyer's profile before the deadline; late uploads are rejected, so allow time for large files.",
      "Ask questions through the same platform; the buyer publishes answers to all registered candidates.",
    ],
  },
  gr: {
    title: "Responding to a Greek (KIMDIS) tender",
    steps: [
      "Open the KIMDIS record and the linked tender documents (διακήρυξη / πρόσκληση) to confirm the procedure and the submission channel.",
      "Most procedures above the low-value thresholds are run electronically on ESIDIS (promitheus.gov.gr), which requires prior supplier registration.",
      "Prepare the ESPD (ΕΕΕΣ/ΤΕΥΔ) and the supporting certificates the documents list, including tax and social-security clearance.",
      "For invitations and direct-award requests, follow the submission method stated in the invitation itself (email, platform or in person).",
      "Check the deadline time and whether the guarantee of participation (εγγυητική επιστολή συμμετοχής) applies.",
    ],
  },
  uk: {
    title: "Responding to a UK (Find a Tender) opportunity",
    steps: [
      "Open the notice on Find a Tender and follow the link to the buyer's e-tendering portal, where the full documents sit.",
      "For procurements under the Procurement Act 2023, register on the Central Digital Platform and keep your core supplier information up to date.",
      "Read the tender notice and associated documents for the procedure, lots, conditions of participation and award criteria.",
      "Submit through the buyer's portal before the deadline; clarification questions also go through that portal.",
    ],
  },
  sam: {
    title: "Responding to a US federal (SAM.gov) opportunity",
    steps: [
      "Read the solicitation attachments on SAM.gov, especially the instructions to offerors and the evaluation factors (commonly Sections L and M).",
      "An active SAM.gov registration with a Unique Entity ID is generally required to receive a federal contract award.",
      "Check the set-aside status, NAICS code and size standard to confirm you are eligible to bid.",
      "Submit exactly as the solicitation directs (email, portal or other method) before the response date and time zone shown.",
    ],
  },
  wb: {
    title: "Responding to a World Bank-financed opportunity",
    steps: [
      "The borrowing agency, not the World Bank, runs the procurement. Contact details and document access are in the official notice.",
      "Procedures follow the World Bank Procurement Regulations for IPF Borrowers; the bidding documents state the method and eligibility rules.",
      "Check eligibility, the bid security requirement and whether submission is electronic or physical.",
      "Send clarification requests to the agency contact by the date in the bidding documents.",
    ],
  },
};

export function RespondGuide({ source }: { source: SourceKey }) {
  const g = GUIDES[source];
  if (!g) return null;
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold">{g.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">General procedure for this publisher. The official tender documents always take precedence.</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
        {g.steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
    </section>
  );
}
