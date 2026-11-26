// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { normalize, type Notice } from "./sources";
import { currentSitemap, readStoredSitemap, rebuildSitemap, renderSitemap, SITEMAP_FRESH_MS, storeSitemap, type LastGoodStore } from "./sitemap";
import { resolveNotice, upsertNotices, type D1Database, type D1Statement } from "./store";

class SqlStatement implements D1Statement {
  private values: unknown[] = [];
  constructor(private db: DatabaseSync, private sql: string, private log: string[]) {}
  bind(...values: unknown[]): D1Statement { this.values = values; return this; }
  async first<T>(): Promise<T | null> { this.log.push(this.sql); return (this.db.prepare(this.sql).get(...this.values as never[]) ?? null) as T | null; }
  async all<T>(): Promise<{ results: T[] }> { this.log.push(this.sql); return { results: this.db.prepare(this.sql).all(...this.values as never[]) as T[] }; }
  async run(): Promise<unknown> { this.log.push(this.sql); return this.db.prepare(this.sql).run(...this.values as never[]); }
}

const migrations = new URL("../../../migrations/", import.meta.url);
/** An in-memory database with every migration applied (or only those up to `upTo`), plus a log of the SQL it ran. */
function memoryDb(upTo = "9999"): { db: D1Database; log: string[]; fail: (on: boolean) => void } {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql") && f.slice(0, 4) <= upTo).sort()) sqlite.exec(readFileSync(new URL(file, migrations), "utf8"));
  const log: string[] = [];
  let failing = false;
  const db: D1Database = {
    prepare: (sql) => { if (failing) throw new Error("D1_ERROR: exceeded its daily limit (7500)"); return new SqlStatement(sqlite, sql, log); },
    batch: async (statements) => {
      if (failing) throw new Error("D1_ERROR: exceeded its daily limit (7500)");
      sqlite.exec("BEGIN");
      try { for (const statement of statements) await statement.run(); sqlite.exec("COMMIT"); }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
      return [];
    },
  };
  return { db, log, fail: (on) => { failing = on; } };
}

function notice(id: string, title = "Road maintenance"): Notice {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return { ...normalize({
    source: "ted", noticeId: id, title, description: "Official resurfacing specification", buyer: "City Council", country: "FRA",
    publishedAt: new Date().toISOString(), deadline: `${tomorrow}T12:00:00Z`, value: 100000, currency: "EUR", cpv: ["45000000"],
    url: `https://ted.europa.eu/en/notice/-/detail/${id}`, stage: "competition",
  }), valueEur: 100000 };
}

function memoryLastGood(initial: string | null = null): LastGoodStore & { value: string | null } {
  const store = { value: initial, get: async () => store.value, put: async (xml: string) => { store.value = xml; } };
  return store;
}

describe("tender lookup", () => {
  it("tells a notice that is not stored from a database that could not be asked", async () => {
    const { db, fail } = memoryDb();
    await upsertNotices(db, [notice("1-2026")]);
    const offline = async () => null; // the publisher lookup found nothing or failed
    expect((await resolveNotice("ted", "1-2026", offline, db)).notice?.noticeId).toBe("1-2026");
    expect(await resolveNotice("ted", "404-2026", offline, db)).toEqual({ notice: null, known: true });
    fail(true);
    expect(await resolveNotice("ted", "1-2026", offline, db)).toEqual({ notice: null, known: false });
    expect((await resolveNotice("ted", "1-2026", async () => notice("1-2026", "Live title"), db)).notice?.title).toBe("Live title");
    expect(await resolveNotice("ted", "1-2026", offline, undefined)).toEqual({ notice: null, known: true });
  });
});

const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
const scans = (log: string[]) => log.filter((sql) => /FROM notices/.test(sql)).length;

describe("sitemap", () => {
  it("lists stored notices, and the country, CPV and country x CPV pages that have at least 5", async () => {
    const { db } = memoryDb();
    await upsertNotices(db, ["1", "2", "3", "4", "5", "6"].map((n) => notice(`${n}-2026`)));
    const doc = await renderSitemap(db);
    const urls = locs(doc.xml);
    expect(urls).toContain("https://tenderatlas.shop/tenders/ted/3-2026");
    expect(urls).toContain("https://tenderatlas.shop/countries/fr/tenders");
    expect(urls).toContain("https://tenderatlas.shop/cpv/45000000");
    expect(urls).toContain("https://tenderatlas.shop/countries/fr/cpv/45000000");
    expect(urls.filter((u) => /\/countries\/[a-z]{2}\/tenders$/.test(u))).toHaveLength(1);
    expect(doc.urls).toBe(urls.length);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("throws when the database fails, instead of returning a sitemap without notices", async () => {
    const { db, fail } = memoryDb();
    await upsertNotices(db, [notice("1-2026")]);
    fail(true);
    await expect(renderSitemap(db)).rejects.toThrow(/daily limit/);
  });

  it("stores the sitemap in rows and reads back exactly the same document", async () => {
    const { db } = memoryDb();
    await upsertNotices(db, ["1", "2", "3"].map((n) => notice(`${n}-2026`)));
    const doc = await renderSitemap(db);
    await storeSitemap(db, doc, 97); // tiny rows, to exercise the split
    const back = await readStoredSitemap(db);
    expect(back?.xml).toBe(doc.xml);
    expect(back?.urls).toBe(doc.urls);
    await storeSitemap(db, { xml: "<urlset>\n</urlset>\n", urls: 0 }); // a shorter document leaves no old rows behind
    expect((await readStoredSitemap(db))?.xml).toBe("<urlset>\n</urlset>\n");
  });

  it("serves the stored copy without scanning notices again, and rebuilds once it is older than the limit", async () => {
    const { db, log } = memoryDb();
    await upsertNotices(db, [notice("1-2026")]);
    const kept = memoryLastGood();
    const first = await currentSitemap(db, kept);
    expect(first?.from).toBe("rebuilt");
    expect(kept.value).toBe(first?.xml);
    log.length = 0;
    const second = await currentSitemap(db, kept);
    expect(second?.from).toBe("stored");
    expect(second?.xml).toBe(first?.xml);
    expect(scans(log)).toBe(0);
    await upsertNotices(db, [notice("2-2026")]);
    const later = await currentSitemap(db, kept, Date.now() + SITEMAP_FRESH_MS + 1000);
    expect(later?.from).toBe("rebuilt");
    expect(locs(later!.xml)).toContain("https://tenderatlas.shop/tenders/ted/2-2026");
  });

  it("rebuilds after an ingest, so the next fetch sees the new notice at once", async () => {
    const { db } = memoryDb();
    await upsertNotices(db, [notice("1-2026")]);
    await currentSitemap(db, memoryLastGood());
    await upsertNotices(db, [notice("2-2026")]);
    await rebuildSitemap(db);
    const doc = await currentSitemap(db, memoryLastGood());
    expect(doc?.from).toBe("stored");
    expect(locs(doc!.xml)).toContain("https://tenderatlas.shop/tenders/ted/2-2026");
  });

  it("serves the last good copy while the database is down, and nothing at all when there is none", async () => {
    const { db, fail } = memoryDb();
    await upsertNotices(db, [notice("1-2026"), notice("2-2026")]);
    const kept = memoryLastGood();
    const good = await currentSitemap(db, kept);
    fail(true);
    const during = await currentSitemap(db, kept);
    expect(during?.from).toBe("last-good");
    expect(during?.xml).toBe(good?.xml);
    expect(during?.urls).toBe(good?.urls);
    // The old code answered here with the static pages only: a sitemap that had lost every notice.
    expect(await currentSitemap(db, memoryLastGood())).toBeNull();
    fail(false);
    expect((await currentSitemap(db, kept))?.from).toBe("stored");
  });

  it("keeps serving an old stored copy when only the rebuild fails", async () => {
    const { db } = memoryDb();
    await upsertNotices(db, [notice("1-2026")]);
    const good = await currentSitemap(db, memoryLastGood());
    // The stored rows stay readable while every scan of `notices` fails.
    const flaky: D1Database = { ...db, prepare: (sql) => { if (/FROM notices/.test(sql)) throw new Error("D1_ERROR: exceeded its daily limit (7500)"); return db.prepare(sql); } };
    const doc = await currentSitemap(flaky, memoryLastGood(), Date.now() + SITEMAP_FRESH_MS + 1000);
    expect(doc?.from).toBe("stale");
    expect(doc?.xml).toBe(good?.xml);
  });

  it("still works before migration 0004 is applied (no site_cache table)", async () => {
    const { db } = memoryDb("0003");
    await upsertNotices(db, [notice("1-2026")]);
    const doc = await currentSitemap(db, memoryLastGood());
    expect(doc?.from).toBe("rebuilt");
    expect(locs(doc!.xml)).toContain("https://tenderatlas.shop/tenders/ted/1-2026");
  });

  it("lists the static pages and every listing page when no database is configured", async () => {
    const doc = await currentSitemap(undefined, memoryLastGood());
    expect(doc?.from).toBe("static");
    expect(locs(doc!.xml)).toContain("https://tenderatlas.shop/methodology");
    expect(locs(doc!.xml).some((u) => u.includes("/tenders/ted/"))).toBe(false);
  });
});
