import { abs } from "./site";
export function pageHead(o: { title: string; description: string; path: string; noindex?: boolean; jsonLd?: unknown; image?: string }) {
  const title = o.title.includes("TenderAtlas") ? o.title : `${o.title} | TenderAtlas`;
  return {
    meta: [
      { title },
      { name: "description", content: o.description },
      { property: "og:title", content: title },
      { property: "og:description", content: o.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: abs(o.path) },
      { name: "twitter:card", content: o.image ? "summary_large_image" : "summary" },
      ...(o.image ? [{ property: "og:image", content: o.image }, { property: "og:image:width", content: "1200" }, { property: "og:image:height", content: "630" }, { name: "twitter:image", content: o.image }] : []),
      ...(o.noindex ? [{ name: "robots", content: "noindex,follow" }] : []),
    ],
    links: [{ rel: "canonical", href: abs(o.path) }],
    scripts: o.jsonLd ? [{ type: "application/ld+json", children: JSON.stringify(o.jsonLd) }] : [],
  };
}
