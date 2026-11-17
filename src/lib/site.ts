// Public production origin, used for canonical URLs and the sitemap. Override with VITE_SITE_URL.
export const SITE_URL = (import.meta.env["VITE_SITE_URL"] as string | undefined)?.replace(/\/$/, "") || "https://tenderatlas.shop";
export const SITE_NAME = "TenderAtlas";
export const abs = (path: string) => `${SITE_URL}${path}`;
