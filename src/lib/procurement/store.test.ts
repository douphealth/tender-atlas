// @vitest-environment node
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { normalize, parseSearch, type Notice } from "./sources";
import { listStoredBuyers, storedSearch, upsertNotices, type D1Database, type D1Statement } from "./store";

class SqlStatement implements D1Statement {
  private values: unknown[] = [];
  constructor(private db: DatabaseSync, private sql: string) {}
  bind(...values: unknown[]): D1Statement { this.values = values; return this; }
  async first<T>(): Promise<T | null> { return (this.db.prepare(this.sql).get(...this.values as never[]) ?? null) as T | null; }
  async all<T>(): Promise<{ results: T[] }> { return { results: this.db.prepare(this.sql).all(...this.values as never[]) as T[] }; }
  async run(): Promise<unknown> { return this.db.prepare(this.sql).run(...this.values as never[]); }
}

function memoryDb(): D1Database {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../../../migrations/0001_directory.sql", import.meta.url), "utf8"));
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
