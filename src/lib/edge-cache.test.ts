// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withEdgeCache } from "./edge-cache";
import { sharedCached } from "./procurement/cache";

/** A minimal Cloudflare Cache API: keeps what is put, honours nothing but the key. */
function fakeCache() {
  const entries = new Map<string, Response>();
  return {
    entries,
    match: async (req: Request) => entries.get(req.url)?.clone(),
    put: async (req: Request, res: Response) => { entries.set(req.url, res.clone()); },
  };
}
const html = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });
const ctx = { waitUntil: (p: Promise<unknown>) => { void p.catch(() => undefined); } };
const opts = { ttl: 60, swr: 120, sie: 3600 };

describe("edge cache", () => {
  let cache: ReturnType<typeof fakeCache>;
  beforeEach(() => { cache = fakeCache(); vi.stubGlobal("caches", { default: cache }); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-26T12:00:00Z")); });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  const get = (render: () => Promise<Response>) => withEdgeCache(new Request("https://tenderatlas.shop/tenders/ted/1-2026"), ctx, opts, render);

  it("serves a copy past its stale window when the fresh render fails", async () => {
    expect((await get(async () => html("good"))).headers.get("x-edge-cache")).toBe("MISS");
    await vi.advanceTimersByTimeAsync(0);
    vi.setSystemTime(new Date("2026-11-26T12:10:00Z")); // past ttl + swr, inside sie
    const res = await get(async () => html("database unavailable", 503));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-edge-cache")).toBe("STALE-IF-ERROR");
    expect(await res.text()).toBe("good");
  });

  it("passes the failure through when there is no copy, or the copy is too old", async () => {
    expect((await get(async () => html("database unavailable", 503))).status).toBe(503);
    await get(async () => html("good"));
    await vi.advanceTimersByTimeAsync(0);
    vi.setSystemTime(new Date("2026-11-26T14:00:00Z")); // past ttl + swr + sie
    expect((await get(async () => html("database unavailable", 503))).status).toBe(503);
  });

  it("does not hide a 404: only a failing render falls back to the kept copy", async () => {
    await get(async () => html("good"));
    await vi.advanceTimersByTimeAsync(0);
    vi.setSystemTime(new Date("2026-11-26T12:10:00Z"));
    expect((await get(async () => html("gone", 404))).status).toBe(404);
  });

  it("keeps the copy for ttl + swr + sie", async () => {
    await get(async () => html("good"));
    await vi.advanceTimersByTimeAsync(0);
    expect([...cache.entries.values()][0]!.headers.get("cache-control")).toBe("public, max-age=3780");
  });
});

describe("sharedCached", () => {
  let cache: ReturnType<typeof fakeCache>;
  beforeEach(() => { cache = fakeCache(); vi.stubGlobal("caches", { default: cache }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("keeps a stored result for hours and a fallback result for minutes", async () => {
    const ttl = (v: { storage: string }) => (v.storage === "database" ? 10800 : 600);
    await sharedCached("t:stored", ttl, async () => ({ storage: "database" }));
    await sharedCached("t:live", ttl, async () => ({ storage: "live" }));
    const kept = Object.fromEntries([...cache.entries].map(([url, res]) => [decodeURIComponent(url.split("/").pop()!), res.headers.get("cache-control")]));
    expect(kept).toEqual({ "t:stored": "public, max-age=10800", "t:live": "public, max-age=600" });
  });

  it("does not keep a failed read at the edge", async () => {
    expect(await sharedCached<null | string[]>("t:failed", (v) => (v ? 10800 : 60), async () => null)).toBeNull();
    expect(cache.entries.size).toBe(0);
  });
});
