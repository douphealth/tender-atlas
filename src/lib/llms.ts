import { abs } from "./site";

const PAGES: [string, string, string][] = [
  ["/", "Home", "Live public tenders traced back to the official publisher notice."],
  [
    "/tenders",
    "Search tenders",
    "Keyword, country, CPV, deadline and value search across official sources.",
  ],
  [
    "/countries",
    "Tenders by country",
    "Official notices grouped by the country named on the publisher record.",
  ],
  [
    "/cpv",
    "CPV categories",
    "Common Procurement Vocabulary divisions used by TED, BOAMP, KIMDIS and Find a Tender.",
  ],
  ["/buyers", "Public buyers", "Contracting authorities in the current official-notice coverage."],
  ["/alerts", "Email and RSS alerts", "Confirmed daily email digests and per-search RSS feeds."],
  [
    "/methodology",
    "Methodology",
    "Which official APIs are read, which fields are never inferred, and the coverage limits.",
  ],
  [
    "/pricing",
    "Tender Readiness Dossiers",
    "Document-backed bid/no-bid dossiers. €290 one-off, plus applicable tax, no subscription.",
  ],
  [
    "/privacy",
    "Privacy",
    "No accounts. Saved tenders stay in the browser. Dossier and alert data is stored only to fulfil that request.",
  ],
];

/** Plain-text site summary for answer engines. Links use SITE_URL, not the request host. */
export function llmsTxt(): string {
  const links = PAGES.map(
    ([path, name, description]) => `- [${name}](${abs(path)}): ${description}`,
  ).join("\n");
  return `# TenderAtlas

> TenderAtlas is an independent directory of public procurement notices read from official publisher APIs. A field the publisher does not provide is shown as not disclosed. The official notice is the authoritative record.

Coverage is TED (European Union), BOAMP (France), KIMDIS (Greece), Find a Tender (United Kingdom), World Bank procurement notices and SAM.gov (United States). Each notice has an internal page and a link to the publisher.

## Key pages

${links}

## Optional

- [Sitemap](${abs("/sitemap.xml")}): Indexable TenderAtlas URLs
`;
}
