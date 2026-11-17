import { abs } from "./site";

const SUFFIX = " | TenderAtlas";

/** Visible <title>, capped at 60 characters, with the site name kept. */
export function fitTitle(raw: string): string {
  const clean = raw.replace(/\s+/g, " ").trim();
  if (!clean) return "TenderAtlas";
  if (clean.includes("TenderAtlas"))
    return clean.length <= 60 ? clean : `${clean.slice(0, 59).trimEnd()}…`;
  const full = `${clean}${SUFFIX}`;
  if (full.length <= 60) return full;
  const budget = 60 - SUFFIX.length - 1;
  let base = clean.slice(0, budget);
  const word = base.replace(/\s+\S*$/, "");
  if (word.length >= 16) base = word;
  return `${base.trimEnd()}…${SUFFIX}`;
}

/** Meta description, capped at 160 characters. */
export function fitDescription(raw: string): string {
  const clean = raw.replace(/\s+/g, " ").trim();
  if (clean.length <= 160) return clean;
  let base = clean.slice(0, 159);
  const word = base.replace(/\s+\S*$/, "");
  if (word.length >= 120) base = word;
  return `${base.trimEnd()}…`;
}

export function breadcrumbList(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}

export function itemList(name: string, items: { name: string; path: string }[]) {
  return {
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: abs(item.path),
    })),
  };
}

export function jsonLd(graph: object[]) {
  return { "@context": "https://schema.org", "@graph": graph };
}

export function pageHead(o: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  jsonLd?: unknown;
  image?: string;
  canonical?: boolean;
}) {
  const title = fitTitle(o.title);
  const description = fitDescription(o.description);
  const image = !o.image ? abs("/og.png") : o.image.startsWith("http") ? o.image : abs(o.image);
  const url = abs(o.path);
  const includeCanonical = o.canonical !== false;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: o.noindex ? "noindex, follow" : "index, follow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      ...(includeCanonical ? [{ property: "og:url", content: url }] : []),
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: title },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
    ],
    links: includeCanonical ? [{ rel: "canonical", href: url }] : [],
    scripts: o.jsonLd ? [{ type: "application/ld+json", children: JSON.stringify(o.jsonLd) }] : [],
  };
}
