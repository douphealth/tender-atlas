// The XML sitemap, built from the stored archive and kept in D1 between ingests.
//
// Why it is stored: building it scans `notices` four times, and every crawler fetch used to do that.
// Why it never shrinks on a failure: when D1 stops answering (for example the account's daily read cap),
// the old code caught the error and published a sitemap of static pages only, so crawlers saw thousands
// of URLs vanish and return within hours. Now a failure serves the last good copy, or says 503.
import { COUNTRIES, CPV_DIVISIONS } from "./catalog";
import { sitemapHubRows, sitemapListingCoverage, sitemapNoticeRows, type D1Database } from "./store";
import { abs, SITE_URL } from "@/lib/site";

const STATIC_PATHS = ["/", "/tenders", "/countries", "/cpv", "/buyers", "/alerts", "/methodology", "/pricing", "/privacy"];
const KEY = "sitemap:v1";
/** Characters per stored row. D1 caps one value at 2 MB; the XML is ASCII (ids are percent-encoded). */
const PART_CHARS = 400_000;
/** Ingest runs every 6 h and rebuilds the stored copy; past this age a request rebuilds it instead. */
export const SITEMAP_FRESH_MS = 7 * 3600_000;

export type SitemapSource = "static" | "stored" | "rebuilt" | "stale" | "last-good";
export interface SitemapDoc { xml: string; urls: number }
/** A copy kept outside D1 (the Cloudflare Cache API in production) for when D1 itself is down. */
export interface LastGoodStore { get(): Promise<string | null>; put(xml: string): Promise<void> }

const XML_ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const xmlEscape = (value: string) => value.replace(/[&<>"']/g, (c) => XML_ENTITIES[c]!);

/**
 * Builds the sitemap from the database. Without a database (local dev, an install with no archive) it lists
 * the static pages and every country and CPV page. With one, a failed query throws: the caller decides
 * what to serve, and never mistakes "the database did not answer" for "there are no notices".
 */
export async function renderSitemap(db?: D1Database): Promise<SitemapDoc> {
  const [notices, hubs, coverage] = await Promise.all([sitemapNoticeRows(db), sitemapHubRows(db), sitemapListingCoverage(db)]);
  // Only list country and CPV pages that clear their own noindex threshold (5+ notices in 30 days).
  const paths = [...STATIC_PATHS,
    ...COUNTRIES.filter((c) => !coverage || coverage.countries.has(c.iso3)).map((c) => `/countries/${c.iso2}/tenders`),
    ...CPV_DIVISIONS.filter((d) => !coverage || coverage.divisions.has(d.code)).map((d) => `/cpv/${d.code}`)];
  const noticeUrls = notices.map((n) => ({ path: `/tenders/${n.source}/${encodeURIComponent(n.notice_id)}`, lastmod: n.updated_at ?? n.published_at }));
  const hubUrls = hubs.flatMap((h) => {
    const country = COUNTRIES.find((c) => c.iso3 === h.country);
    return country && CPV_DIVISIONS.some((d) => d.code === h.division) ? [{ path: `/countries/${country.iso2}/cpv/${h.division}`, lastmod: h.lastmod }] : [];
  });
  const staticXml = paths.map((path) => `  <url><loc>${xmlEscape(abs(path))}</loc></url>`).join("\n");
  const dynamic = [...noticeUrls, ...hubUrls];
  const dynamicXml = dynamic.map((entry) => `  <url><loc>${xmlEscape(abs(entry.path))}</loc>${entry.lastmod && /^\d{4}-\d{2}-\d{2}$/.test(entry.lastmod) ? `<lastmod>${entry.lastmod}</lastmod>` : ""}</url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${staticXml}${dynamicXml ? `\n${dynamicXml}` : ""}\n</urlset>\n`;
  return { xml, urls: paths.length + dynamic.length };
}

/** Replaces the stored sitemap in one transaction, split into rows small enough for D1. */
export async function storeSitemap(db: D1Database, doc: SitemapDoc, partChars = PART_CHARS): Promise<void> {
  const now = new Date().toISOString();
  const parts: string[] = [];
  for (let i = 0; i < doc.xml.length; i += partChars) parts.push(doc.xml.slice(i, i + partChars));
  const insert = "INSERT INTO site_cache (key, value, updated_at) VALUES (?, ?, ?)";
  await db.batch([
    db.prepare("DELETE FROM site_cache WHERE key >= ? AND key < ?").bind(`${KEY}:`, `${KEY};`),
    ...parts.map((value, i) => db.prepare(insert).bind(`${KEY}:${String(i).padStart(4, "0")}`, value, now)),
    db.prepare(insert).bind(`${KEY}:meta`, JSON.stringify({ parts: parts.length, urls: doc.urls, length: doc.xml.length }), now),
  ]);
}

/** The stored sitemap, or null when none is stored or its rows do not add up. Throws when D1 fails. */
export async function readStoredSitemap(db: D1Database): Promise<(SitemapDoc & { builtAt: number }) | null> {
  const rows = (await db.prepare("SELECT key, value, updated_at FROM site_cache WHERE key >= ? AND key < ? ORDER BY key")
    .bind(`${KEY}:`, `${KEY};`).all<{ key: string; value: string; updated_at: string }>()).results;
  const meta = rows.find((r) => r.key === `${KEY}:meta`);
  if (!meta) return null;
  let info: { parts?: number; urls?: number; length?: number };
  try { info = JSON.parse(meta.value); } catch { return null; }
  const parts = rows.filter((r) => r !== meta).map((r) => r.value);
  const xml = parts.join("");
  if (parts.length !== info.parts || xml.length !== info.length || !xml.endsWith("</urlset>\n")) return null;
  return { xml, urls: Number(info.urls) || 0, builtAt: Date.parse(meta.updated_at) };
}

/** Rebuilds and stores the sitemap. Called after each ingest; throws when the database fails. */
export async function rebuildSitemap(db: D1Database): Promise<SitemapDoc> {
  const doc = await renderSitemap(db);
  await storeSitemap(db, doc);
  return doc;
}

/**
 * The sitemap to serve now, and where it came from. Order: the stored copy while fresh; else a rebuild;
 * else (the database is failing) the stored copy however old, then the copy kept outside D1.
 * Null means nothing trustworthy is available, and the caller must answer 503, not an empty sitemap.
 */
export async function currentSitemap(db: D1Database | undefined, lastGood: LastGoodStore, now = Date.now()): Promise<(SitemapDoc & { from: SitemapSource }) | null> {
  if (!db) return { ...(await renderSitemap(undefined)), from: "static" };
  let stored: Awaited<ReturnType<typeof readStoredSitemap>> = null;
  // A failed read is not fatal on its own: the table may not exist yet (migration 0004 not applied).
  try { stored = await readStoredSitemap(db); } catch { stored = null; }
  if (stored && now - stored.builtAt < SITEMAP_FRESH_MS) {
    await lastGood.put(stored.xml);
    return { xml: stored.xml, urls: stored.urls, from: "stored" };
  }
  try {
    const doc = await renderSitemap(db);
    await storeSitemap(db, doc).catch((error) => console.error("Sitemap: built, but could not be stored", error));
    await lastGood.put(doc.xml);
    return { ...doc, from: "rebuilt" };
  } catch (error) {
    console.error("Sitemap: the database did not answer; serving the last good copy", error);
    if (stored) return { xml: stored.xml, urls: stored.urls, from: "stale" };
    const kept = await lastGood.get();
    return kept ? { xml: kept, urls: (kept.match(/<loc>/g) ?? []).length, from: "last-good" } : null;
  }
}

/** The last good sitemap in the Cloudflare Cache API: per data centre, kept two weeks, not tied to a build. */
export function cacheApiLastGood(): LastGoodStore {
  const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
  const req = new Request(`${SITE_URL}/__data-cache/sitemap-last-good-v1`);
  return {
    get: async () => { try { return (await (await cache?.match(req))?.text()) ?? null; } catch { return null; } },
    put: async (xml) => {
      await cache?.put(req, new Response(xml, { headers: { "content-type": "application/xml", "cache-control": "public, max-age=1209600" } })).catch(() => undefined);
    },
  };
}
