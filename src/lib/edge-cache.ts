// Short-lived edge cache for server-rendered public HTML (Cloudflare Cache API).
// Pages here are built from live publisher feeds on every request; caching the finished HTML for a
// few minutes per data centre cuts time-to-first-byte from seconds to milliseconds for repeat visits.
// Only anonymous GET requests for HTML that rendered with 200 and set no cookie are stored.

type Ctx = { waitUntil?(p: Promise<unknown>): void } | undefined;
type CacheStorageCF = { default: Cache };

export async function withEdgeCache(
  request: Request,
  ctx: unknown,
  opts: { ttl: number; skip?: (path: string) => boolean },
  render: () => Promise<Response>,
): Promise<Response> {
  const cache = (globalThis as unknown as { caches?: CacheStorageCF }).caches?.default;
  const url = new URL(request.url);
  if (!cache || request.method !== "GET" || request.headers.has("authorization") || opts.skip?.(url.pathname)) {
    return render();
  }
  const key = new Request(url.toString(), { method: "GET" });
  try {
    const hit = await cache.match(key);
    if (hit) {
      const res = new Response(hit.body, hit);
      res.headers.set("x-edge-cache", "HIT");
      res.headers.set("cache-control", "public, max-age=0, must-revalidate");
      return res;
    }
  } catch { /* cache unavailable: render normally */ }
  const response = await render();
  const type = response.headers.get("content-type") ?? "";
  if (response.status !== 200 || !type.includes("text/html") || response.headers.has("set-cookie")) return response;
  const stored = new Response(response.clone().body, response);
  stored.headers.set("cache-control", `public, max-age=${opts.ttl}`);
  const put = cache.put(key, stored).catch(() => undefined);
  const c = ctx as Ctx;
  if (c?.waitUntil) c.waitUntil(put); else await put;
  const res = new Response(response.body, response);
  res.headers.set("x-edge-cache", "MISS");
  return res;
}
