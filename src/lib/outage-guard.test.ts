// @vitest-environment node
import { describe, expect, it } from "vitest";
import { databaseAnswers, guardOutage, isGuardedPath } from "./outage-guard";
import { cached } from "./procurement/cache";

const page = (robots: string | null, status = 200) => new Response(
  `<!doctype html><html><head><title>t</title>${robots ? `<meta name="robots" content="${robots}"/>` : ""}</head><body>page body</body></html>`,
  { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
const get = (path: string) => new Request(`https://tenderatlas.shop${path}`);
const down = async () => false;
const up = async () => true;
const none = async () => null;

describe("outage guard", () => {
  it("covers the indexable page types and nothing else", () => {
    for (const p of ["/tenders/ted/809399-2026", "/countries/fr/tenders", "/countries/fr/cpv/45000000", "/cpv/45000000", "/buyers/city-council"]) expect(isGuardedPath(p)).toBe(true);
    for (const p of ["/", "/tenders", "/app", "/alerts", "/sitemap.xml", "/api/search", "/og/tenders/ted/1-2026.png", "/tenders.rss"]) expect(isGuardedPath(p)).toBe(false);
  });

  it("turns a 404 into a 503 with Retry-After while the database is down, and keeps the page body", async () => {
    const res = await guardOutage(get("/tenders/ted/809399-2026"), page("noindex,follow", 404), down);
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("3600");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toContain("page body");
  });

  it("turns a noindex listing into a 503 while the database is down", async () => {
    expect((await guardOutage(get("/countries/fr/tenders"), page("noindex,follow"), down)).status).toBe(503);
    // attribute order and quoting do not matter
    const other = new Response(`<meta content='noindex' name='robots'>`, { headers: { "content-type": "text/html" } });
    expect((await guardOutage(get("/cpv/45000000"), other, down)).status).toBe(503);
  });

  it("leaves an indexable page alone during an outage", async () => {
    expect((await guardOutage(get("/tenders/ted/809399-2026"), page(null), down)).status).toBe(200);
    expect((await guardOutage(get("/tenders/ted/809399-2026"), page("index,follow"), down)).status).toBe(200);
  });

  it("changes nothing when the database answers or none is configured", async () => {
    for (const answers of [up, none]) {
      expect((await guardOutage(get("/tenders/ted/1-2026"), page("noindex,follow", 404), answers)).status).toBe(404);
      expect((await guardOutage(get("/countries/fr/tenders"), page("noindex,follow"), answers)).status).toBe(200);
    }
  });

  it("does not touch other paths, other methods or other statuses, and does not probe for them", async () => {
    let probes = 0;
    const counting = async () => { probes++; return false; };
    const asked: boolean[] = [];
    await guardOutage(get("/tenders/ted/1-2026"), page(null, 404), async (fresh) => { asked.push(fresh); return true; });
    await guardOutage(get("/countries/fr/tenders"), page("noindex,follow"), async (fresh) => { asked.push(fresh); return true; });
    expect(asked).toEqual([true, false]);
    expect((await guardOutage(get("/app"), page("noindex,follow"), counting)).status).toBe(200);
    expect((await guardOutage(get("/tenders?q=roads"), page("noindex,follow"), counting)).status).toBe(200);
    expect((await guardOutage(new Request("https://tenderatlas.shop/tenders/ted/1-2026", { method: "POST" }), page(null, 404), counting)).status).toBe(404);
    expect((await guardOutage(get("/tenders/ted/1-2026"), page(null, 500), counting)).status).toBe(500);
    expect(probes).toBe(0);
  });
});

describe("database probe", () => {
  const probe = (fails: () => boolean) => {
    const db = { calls: 0, prepare: () => ({ first: async () => { db.calls++; if (fails()) throw new Error("D1_ERROR"); return { fresh: "x" }; } }) };
    return db;
  };

  it("is null without a database", async () => { expect(await databaseAnswers(undefined)).toBeNull(); });

  it("remembers a healthy answer for a minute and a failure for twenty seconds", async () => {
    let failing = false;
    const db = probe(() => failing);
    expect(await databaseAnswers(db, false, 0)).toBe(true);
    failing = true;
    expect(await databaseAnswers(db, false, 59_000)).toBe(true);
    expect(db.calls).toBe(1);
    expect(await databaseAnswers(db, false, 61_000)).toBe(false);
    failing = false;
    expect(await databaseAnswers(db, false, 80_000)).toBe(false);
    expect(await databaseAnswers(db, false, 82_000)).toBe(true);
    expect(db.calls).toBe(3);
  });

  it("asks again before a 404 even when it answered a moment ago, but trusts a remembered failure", async () => {
    let failing = false;
    const db = probe(() => failing);
    expect(await databaseAnswers(db, false, 0)).toBe(true);
    failing = true;
    expect(await databaseAnswers(db, true, 1_000)).toBe(false);
    expect(await databaseAnswers(db, true, 2_000)).toBe(false);
    expect(db.calls).toBe(2);
  });
});

describe("cached", () => {
  it("can keep a miss for less time than a hit", async () => {
    let calls = 0;
    const ttl = (v: string | null) => (v ? 60_000 : 0);
    expect(await cached("outage-test:miss", ttl, async () => { calls++; return null; })).toBeNull();
    expect(await cached("outage-test:miss", ttl, async () => { calls++; return "found"; })).toBe("found");
    expect(await cached("outage-test:miss", ttl, async () => { calls++; return "again"; })).toBe("found");
    expect(calls).toBe(2);
  });
});
