import { SITE_URL } from "@/lib/site";

/** How long a result read from the stored archive is reused. The archive changes only at the 6-hourly ingest. */
export const STORED_TTL = 3 * 3600;
/** How long a fallback result (live publishers, or "the database did not answer") is reused. */
export const FALLBACK_TTL = 10 * 60;

// Small per-isolate memo cache so repeated page views don't hammer official publishers.
const store = new Map<string, { at: number; value: unknown }>();
// `ttlMs` may depend on the value, so a miss ("not found") can be kept for less time than a hit.
export async function cached<T>(key: string, ttlMs: number | ((value: T) => number), fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < (typeof ttlMs === "function" ? ttlMs(hit.value as T) : ttlMs)) return hit.value as T;
  const value = await fn();
  store.set(key, { at: Date.now(), value });
  if (store.size > 500) store.delete(store.keys().next().value as string);
  return value;
}

// Unique per build (vite.config.ts `define`), so a deploy that changes a result's shape never reads old entries.
declare const __BUILD_ID__: string;
const BUILD = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";
type CacheStorageCF = { default: Cache };

/**
 * cached() plus Cloudflare's Cache API, which every isolate in a data centre shares. Isolates are short-lived,
 * so with the memo alone most crawler hits re-ran their D1 queries, and D1 bills rows read (the free plan caps
 * them per account per day, across every database on the account). The stored archive only changes when the
 * 6-hourly ingest runs, so results read from it are kept for hours (STORED_TTL). Values must be JSON-serialisable; null/undefined are not stored at the edge.
 * Where the Cache API is unavailable (tests, local dev, *.pages.dev) this is the memo alone.
 */
export async function sharedCached<T>(key: string, ttlSec: number | ((value: T) => number), fn: () => Promise<T>): Promise<T> {
  // A function lets a result read from the stored archive be kept for hours while a fallback result
  // (the database did not answer) is kept for minutes, so recovery is never masked by a long-lived fallback.
  const seconds = (value: T) => (typeof ttlSec === "function" ? ttlSec(value) : ttlSec);
  return cached(key, (value: T) => seconds(value) * 1000, async () => {
    const cache = (globalThis as unknown as { caches?: CacheStorageCF }).caches?.default;
    if (!cache) return fn();
    // Our own origin keeps the entry in this zone's cache; the path is never served as a page.
    const req = new Request(`${SITE_URL}/__data-cache/${BUILD}/${encodeURIComponent(key)}`);
    try {
      const hit = await cache.match(req);
      if (hit) return (await hit.json()) as T;
    } catch { /* cache unavailable: compute normally */ }
    const value = await fn();
    const keep = value != null ? Math.floor(seconds(value)) : 0;
    if (keep > 0) {
      await cache.put(req, new Response(JSON.stringify(value), {
        headers: { "content-type": "application/json", "cache-control": `public, max-age=${keep}` },
      })).catch(() => undefined);
    }
    return value;
  });
}
