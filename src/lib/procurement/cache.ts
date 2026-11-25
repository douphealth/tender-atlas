import { SITE_URL } from "@/lib/site";

// Small per-isolate memo cache so repeated page views don't hammer official publishers.
const store = new Map<string, { at: number; value: unknown }>();
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
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
 * them per account per day). The stored archive only changes when the 6-hourly ingest runs, so minutes of
 * staleness cost nothing. Values must be JSON-serialisable; null/undefined are not stored at the edge.
 * Where the Cache API is unavailable (tests, local dev, *.pages.dev) this is the memo alone.
 */
export async function sharedCached<T>(key: string, ttlSec: number, fn: () => Promise<T>): Promise<T> {
  return cached(key, ttlSec * 1000, async () => {
    const cache = (globalThis as unknown as { caches?: CacheStorageCF }).caches?.default;
    if (!cache) return fn();
    // Our own origin keeps the entry in this zone's cache; the path is never served as a page.
    const req = new Request(`${SITE_URL}/__data-cache/${BUILD}/${encodeURIComponent(key)}`);
    try {
      const hit = await cache.match(req);
      if (hit) return (await hit.json()) as T;
    } catch { /* cache unavailable: compute normally */ }
    const value = await fn();
    if (value != null) {
      await cache.put(req, new Response(JSON.stringify(value), {
        headers: { "content-type": "application/json", "cache-control": `public, max-age=${ttlSec}` },
      })).catch(() => undefined);
    }
    return value;
  });
}
