// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { normalize, parseSearch, type Notice } from "./sources";
import { listStoredBuyers, relatedStored, storedSearch, upsertNotices, type D1Database, type D1Statement } from "./store";

class SqlStatement implements D1Statement {
  private values: unknown[] = [];
  constructor(private db: DatabaseSync, private sql: string) {}
  bind(...values: unknown[]): D1Statement { this.values = values; return this; }
  async first<T>(): Promise<T | null> { return (this.db.prepare(this.sql).get(...this.values as never[]) ?? null) as T | null; }
  async all<T>(): Promise<{ results: T[] }> { return { results: this.db.prepare(this.sql).all(...this.values as never[]) as T[] }; }
  async run(): Promise<unknown> { return this.db.prepare(this.sql).run(...this.values as never[]); }
}

const migrations = new URL("../../../migrations/", import.meta.url);
function migratedSqlite(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(new URL(file, migrations), "utf8"));
  return db;
}

function memoryDb(db = migratedSqlite()): D1Database {
  return {
    prepare: (sql) => new SqlStatement(db, sql),
    batch: async (statements) => {
      db.exec("BEGIN");
      try { for (const statement of statements) await statement.run(); db.exec("COMMIT"); }
      catch (error) { db.exec("ROLLBACK"); throw error; }
      return [];
    },
  };
}

function notice(id: string, title: string): Notice {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return { ...normalize({
    source: "ted", noticeId: id, title, description: "Official resurfacing specification", buyer: "City Council", country: "FRA",
    publishedAt: new Date().toISOString(), deadline: `${tomorrow}T12:00:00Z`, value: 100000, currency: "EUR", cpv: ["45000000"],
    url: `https://ted.europa.eu/en/notice/-/detail/${id}`, stage: "competition",
  }), valueEur: 100000 };
}

describe("stored directory search", () => {
  it("updates full-text entries when a notice is ingested again", async () => {
    const db = memoryDb();
    await upsertNotices(db, [notice("1-2026", "Road maintenance")]);
    expect((await storedSearch(parseSearch({ q: "road" }), db))?.total).toBe(1);
    await upsertNotices(db, [notice("1-2026", "Bridge repair")]);
    expect((await storedSearch(parseSearch({ q: "road" }), db))?.total).toBe(0);
    expect((await storedSearch(parseSearch({ q: "bridge" }), db))?.total).toBe(1);
  });

  it("applies CPV, deadline and euro-value limits to stored notices", async () => {
    const db = memoryDb();
    await upsertNotices(db, [notice("1-2026", "Road maintenance")]);
    const matching = parseSearch({ cpv: "45000000", deadline: "7d", minValueEur: "50000", maxValueEur: "150000" });
    expect((await storedSearch(matching, db))?.total).toBe(1);
    expect((await storedSearch(parseSearch({ minValueEur: "200000" }), db))?.total).toBe(0);
  });

  it("aggregates buyer history without duplicating repeat ingestion", async () => {
    const db = memoryDb();
    await upsertNotices(db, [notice("1-2026", "Road maintenance")]);
    await upsertNotices(db, [notice("1-2026", "Road maintenance updated")]);
    expect(await listStoredBuyers(db)).toEqual([expect.objectContaining({ name: "City Council", count: 1, open: 1, countries: 1 })]);
  });
});

describe("D1 read cost", () => {
  // D1 bills rows read; the free plan's daily cap is shared by every database on the account.
  const plan = (db: DatabaseSync, sql: string) => (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as { detail: string }[]).map((r) => r.detail).join(" | ");

  it("serves the hot queries from indexes instead of scanning notices", () => {
    const db = migratedSqlite();
    expect(plan(db, "SELECT MAX(last_seen_at) AS fresh FROM notices")).toContain("notices_last_seen_idx");
    expect(plan(db, "SELECT payload, value_eur FROM notices WHERE country = 'FRA' AND status = 'open' ORDER BY published_at DESC LIMIT 100"))
      .toContain("notices_country_idx (country=?)");
    expect(plan(db, "SELECT COUNT(*) FROM notices n WHERE n.published_at >= '2026-01-01' AND n.source IN ('ted') AND n.country = 'FRA'"))
      .toContain("notices_country_idx (country=? AND published_at>?)");
  });

  it("finds related open notices in the same country and CPV division", async () => {
    const db = memoryDb();
    await upsertNotices(db, [notice("1-2026", "Road maintenance"), { ...notice("2-2026", "Bridge repair"), buyer: "Other Council" }]);
    const related = await relatedStored({ source: "ted", noticeId: "1-2026", buyer: null, country: "FRA", cpv: ["45000000"] }, db);
    expect(related.map((n) => n.noticeId)).toEqual(["2-2026"]);
  });

  it("matches the CPV division inside one bounded per-country read", async () => {
    const db = memoryDb();
    const other = (id: string, cpv: string[]): Notice => ({ ...notice(id, `Notice ${id}`), buyer: `Buyer ${id}`, country: "DEU", cpv });
    await upsertNotices(db, [other("10-2026", ["45000000"]), other("11-2026", ["33000000"]), other("12-2026", ["45200000"]), other("13-2026", ["72000000"])]);
    const related = await relatedStored({ source: "ted", noticeId: "10-2026", buyer: null, country: "DEU", cpv: ["45000000"] }, db);
    expect(related.map((n) => n.noticeId)).toEqual(["12-2026"]);
  });

  it("does not rewrite an unchanged notice on re-ingest, and still stamps the ingest time", async () => {
    const raw = migratedSqlite();
    const db = memoryDb(raw);
    const seen = (id: string) => (raw.prepare("SELECT last_seen_at AS at FROM notices WHERE notice_id = ?").get(id) as { at: string }).at;
    const [a, b] = [notice("1-2026", "Road maintenance"), { ...notice("2-2026", "Bridge repair"), buyer: "Other Council" }];
    await upsertNotices(db, [a, b]);
    const first = seen("2-2026");
    await new Promise((r) => setTimeout(r, 5));
    const before = (raw.prepare("SELECT total_changes() AS n").get() as { n: number }).n;
    await upsertNotices(db, [a, b]);
    const changes = (raw.prepare("SELECT total_changes() AS n").get() as { n: number }).n - before;
    expect(seen("2-2026")).toBe(first); // untouched
    expect(seen("1-2026") > first).toBe(true); // the one-row freshness stamp
    // A real change is still written, and costs what the unchanged re-ingest no longer does.
    const mark = (raw.prepare("SELECT total_changes() AS n").get() as { n: number }).n;
    await upsertNotices(db, [{ ...a, title: "Road maintenance and marking" }, { ...b, title: "Bridge repair and painting" }]);
    const rewrite = (raw.prepare("SELECT total_changes() AS n").get() as { n: number }).n - mark;
    expect((await storedSearch(parseSearch({ q: "painting" }), db))?.total).toBe(1);
    expect(changes * 2).toBeLessThan(rewrite); // only the one-row stamp (and its full-text entry) was written
  });
});
