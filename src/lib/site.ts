// Canonical origin for every public URL this app emits: canonical links, sitemap
// locations, Open Graph, JSON-LD, RSS and email links. Override with VITE_SITE_URL.
// Never read the request Host. A Cloudflare Pages preview hostname is not an
// allowed canonical origin — Google rejects those sitemap URLs as "URL not allowed".
export const DEFAULT_SITE_URL = "https://tenderatlas.shop";

function siteUrlFromEnv(value: string | undefined): string {
  const trimmed = value?.trim().replace(/\/$/, "");
  if (!trimmed) return DEFAULT_SITE_URL;
  try {
    const url = new URL(trimmed);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.hostname.endsWith(".pages.dev")
    )
      return DEFAULT_SITE_URL;
    return `${url.protocol}//${url.host}`;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const SITE_URL = siteUrlFromEnv(import.meta.env["VITE_SITE_URL"] as string | undefined);
export const SITE_NAME = "TenderAtlas";
export const abs = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
