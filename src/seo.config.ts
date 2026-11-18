// Site-wide SEO settings used by src/lib/seo-edge.ts, /sitemap.xml and /llms.txt.
export type SeoPage = { path: string; title: string; section?: string; desc?: string; lastmod?: string };
import { COUNTRIES, CPV_DIVISIONS } from "@/lib/procurement/catalog";

export const SEO = {
  origin: "https://tenderatlas.shop",
  pagesDevHost: "tender-atlas.pages.dev",
  name: "TenderAtlas",
  description: "Find open public tenders across Europe, the UK, France, Greece, the US and World Bank projects. Every notice links to its official publisher.",
  lang: "en",
  logo: "/favicon.svg" as string | undefined,
  sameAs: [] as string[],
  sectionNames: {} as Record<string, string>,
  keepTrailingSlash: false,
  // Google AdSense publisher ID ("ca-pub-…"). Empty = no ad code and no /ads.txt.
  adsenseClient: "",
};

export const LLMS_NOTES: string[] = [
  "Notices are mirrored from official procurement publishers; each notice links to the original."
];

export function seoPages(): SeoPage[] {
  return [
    { path: "/", title: "TenderAtlas — Live public tenders", section: "Start here" },
    { path: "/tenders", title: "Search public tenders", section: "Start here" },
    { path: "/countries", title: "Public tenders by country", section: "Start here" },
    { path: "/cpv", title: "Tenders by CPV category", section: "Start here" },
    { path: "/buyers", title: "Public buyers", section: "Start here" },
    { path: "/alerts", title: "Tender alerts", section: "Services" },
    { path: "/pricing", title: "Pricing", section: "Services" },
    { path: "/methodology", title: "Methodology and sources", section: "About" },
    ...COUNTRIES.map((c) => ({ path: `/countries/${c.iso2}/tenders`, title: `Public tenders in ${c.name}`, section: "Countries" })),
    ...CPV_DIVISIONS.map((d) => ({ path: `/cpv/${d.code}`, title: `${d.name} tenders (CPV ${d.code.slice(0, 2)})`, section: "CPV categories" })),
  ];
}
