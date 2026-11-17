import { COUNTRIES, CPV_DIVISIONS } from "./procurement/catalog";
import { abs } from "./site";

/** Directory URLs that exist as real pages. Notice and country×CPV rows are added only when stored coverage shows they are indexable. */
export const STATIC_SITEMAP_PATHS = [
  "/",
  "/tenders",
  "/countries",
  "/cpv",
  "/buyers",
  "/alerts",
  "/methodology",
  "/pricing",
  "/privacy",
  ...COUNTRIES.map((c) => `/countries/${c.iso2}/tenders`),
  ...CPV_DIVISIONS.map((d) => `/cpv/${d.code}`),
];

const xmlEscape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );

/** Publisher dates are used as lastmod only when they are a real calendar day. */
export function sitemapLastmod(value: string | null | undefined): string | null {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const day = match[1]!;
  const parsed = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day) return null;
  return day;
}

export function renderSitemap(entries: { path: string; lastmod?: string | null }[]): string {
  const urls = entries
    .map((entry) => {
      const lastmod = sitemapLastmod(entry.lastmod);
      return `  <url><loc>${xmlEscape(abs(entry.path))}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
