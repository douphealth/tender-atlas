import { SOURCE_KEYS, SOURCES, type SourceKey } from "./catalog";
import { collect, cpvPrefix, type Env, type Notice, type SearchParams, type SearchResult } from "./sources";
import { officialEuroRates, toEur } from "./money";
import { buyerSlug, reconcileNotices } from "./reconcile";

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface D1Database { prepare(sql: string): D1Statement; batch(statements: D1Statement[]): Promise<unknown[]> }
export interface AtlasEnv extends Env {
  DB?: D1Database | undefined;
  TURNSTILE_SECRET_KEY?: string | undefined;
  RESEND_API_KEY?: string | undefined;
  NOTIFICATION_FROM_EMAIL?: string | undefined;
  NOTIFICATION_TO_EMAIL?: string | undefined;
  STRIPE_SECRET_KEY?: string | undefined;
  STRIPE_PRICE_ID?: string | undefined;
  STRIPE_WEBHOOK_SECRET?: string | undefined;
  CRON_SECRET?: string | undefined;
}

const dateAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
const pageSize = 50;
const json = (value: unknown) => JSON.stringify(value);
const rowNotice = (row: { payload: string; value_eur?: number | null }): Notice => ({ ...JSON.parse(row.payload), valueEur: row.value_eur ?? null });

async function usableDb(db?: D1Database): Promise<D1Database | null> {
  if (!db) return null;
  try {
    const row = await db.prepare("SELECT COUNT(*) AS count, MAX(last_seen_at) AS fresh FROM notices").first<{ count: number; fresh: string | null }>();
    if (!row?.count || !row.fresh || Date.now() - Date.parse(row.fresh) > 26 * 60 * 60_000) return null;
    return db;
  } catch { return null; }
}

function ftsQuery(q: string): string {
  return (q.match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8).map((term) => `"${term.replaceAll('"', "")}"*`).join(" AND ");
}

function filters(p: SearchParams, only: SourceKey[] | undefined, prefix: string): { sql: string; values: unknown[] } {
  const where = [`${prefix}published_at >= ?`];
  const values: unknown[] = [dateAgo(p.days)];
  const sources = (only ?? SOURCE_KEYS).filter((s) => p.source === "all" || p.source === s);
  if (sources.length) { where.push(`${prefix}source IN (${sources.map(() => "?").join(",")})`); values.push(...sources); }
  else where.push("0");
  if (p.country) { where.push(`${prefix}country = ?`); values.push(p.country); }
  if (p.cpv) {
    const cpv = cpvPrefix(p.cpv);
    where.push(`EXISTS (SELECT 1 FROM json_each(${prefix}cpv) WHERE substr(json_each.value, 1, ?) = ?)`); values.push(cpv.length, cpv);
  }
  if (p.deadline === "48h" || p.deadline === "7d") {
    where.push(`${prefix}deadline_at >= date('now')`, `${prefix}deadline_at <= date('now', ?)`);
    values.push(p.deadline === "48h" ? "+2 days" : "+7 days");
  }
  if (p.minValueEur != null) { where.push(`${prefix}value_eur >= ?`); values.push(p.minValueEur); }
  if (p.maxValueEur != null) { where.push(`${prefix}value_eur <= ?`); values.push(p.maxValueEur); }
  return { sql: where.join(" AND "), values };
}

export async function storedSearch(p: SearchParams, dbInput?: D1Database, only?: SourceKey[]): Promise<SearchResult | null> {
  const started = Date.now();
  const db = await usableDb(dbInput);
  if (!db) return null;
  const f = filters(p, only, "n.");
  const query = ftsQuery(p.q);
  const join = query ? "JOIN notices_fts f ON f.rowid = n.rowid" : "";
  const match = query ? " AND notices_fts MATCH ?" : "";
  const matchValues = query ? [query] : [];
  try {
    const count = await db.prepare(`SELECT COUNT(*) AS total FROM notices n ${join} WHERE ${f.sql}${match}`).bind(...f.values, ...matchValues).first<{ total: number }>();
    const rows = await db.prepare(`SELECT n.payload, n.value_eur FROM notices n ${join} WHERE ${f.sql}${match} ORDER BY n.published_at DESC, n.id DESC LIMIT ? OFFSET ?`)
      .bind(...f.values, ...matchValues, pageSize, (p.page - 1) * pageSize).all<{ payload: string; value_eur: number | null }>();
    const items = reconcileNotices(rows.results.map(rowNotice));
    const health: SearchResult["health"] = {};
    for (const source of (only ?? SOURCE_KEYS).filter((s) => p.source === "all" || p.source === s)) {
      if (p.cpv && !SOURCES[source].supportsCpv) health[source] = { status: "excluded", count: 0, message: "Source does not use CPV codes" };
      else health[source] = { status: "ok", count: items.filter((n) => n.source === source).length, coverage: "Indexed official notices in your Cloudflare database" };
    }
    const total = Number(count?.total ?? 0);
    return { items, health, fetchedAt: new Date().toISOString(), durationMs: Date.now() - started, params: p, storage: "database", total, pageSize, hasNext: p.page * pageSize < total };
  } catch (error) {
    console.error("Stored search failed; using live official sources", error);
    return null;
  }
}

export async function searchWithStore(p: SearchParams, env: AtlasEnv, only?: SourceKey[]): Promise<SearchResult> {
  const stored = await storedSearch(p, env.DB, only);
  if (stored) return stored;
  const live = await collect(p, env, only);
  return { ...live, storage: "live", total: Math.max(live.items.length, ...Object.values(live.health).map((h) => h?.total ?? 0)), pageSize: live.items.length || 50, hasNext: live.items.length >= 40 };
}

export async function storedNotice(source: string, id: string, db?: D1Database): Promise<Notice | null> {
  if (!db) return null;
  try {
    const row = await db.prepare("SELECT payload, value_eur FROM notices WHERE source = ? AND notice_id = ?").bind(source, id).first<{ payload: string; value_eur: number | null }>();
    return row ? rowNotice(row) : null;
  } catch { return null; }
}

export async function upsertNotices(db: D1Database, notices: Notice[]): Promise<number> {
  if (!notices.length) return 0;
  const now = new Date().toISOString();
  const statements = notices.map((n) => db.prepare(`INSERT INTO notices (
    id, source, notice_id, title, description, buyer, buyer_slug, country, published_at, updated_at, deadline_at,
    value, currency, value_eur, cpv, status, url, payload, last_seen_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description, buyer=excluded.buyer, buyer_slug=excluded.buyer_slug,
    country=excluded.country, published_at=excluded.published_at, updated_at=excluded.updated_at,
    deadline_at=excluded.deadline_at, value=excluded.value, currency=excluded.currency, value_eur=excluded.value_eur,
    cpv=excluded.cpv, status=excluded.status, url=excluded.url, payload=excluded.payload, last_seen_at=excluded.last_seen_at`)
    .bind(n.id, n.source, n.noticeId, n.title, n.description, n.buyer, n.buyer ? buyerSlug(n.buyer) : null, n.country, n.publishedAt, n.updatedAt, n.deadlineAt, n.value, n.currency, n.valueEur ?? null, json(n.cpv), n.status, n.url, json(n), now));
  for (let i = 0; i < statements.length; i += 50) await db.batch(statements.slice(i, i + 50));
  return notices.length;
}

export async function ingestIncremental(env: AtlasEnv): Promise<{ stored: number; sources: Record<string, number | string> }> {
  if (!env.DB) throw new Error("Cloudflare D1 is not configured");
  const rates = await officialEuroRates();
  const report: Record<string, number | string> = {};
  let stored = 0;
  for (const source of SOURCE_KEYS) {
    let sourceCount = 0;
    try {
      const pages = source === "uk" ? 1 : 3;
      for (let page = 1; page <= pages; page++) {
        const result = await collect({ q: "", source, country: "", days: 7, page, cpv: "", deadline: "any" }, env, [source]);
        // collect() records publisher failures in health instead of throwing; surface them in the report.
        const h = result.health?.[source];
        if (!result.items.length && h && h.status !== "ok") throw new Error(`${h.status}: ${h.message ?? "no message"}`);
        const notices = result.items.map((n) => ({ ...n, valueEur: toEur(n.value, n.currency, rates) }));
        sourceCount += await upsertNotices(env.DB, notices);
        if (result.items.length < 20) break;
      }
      report[source] = sourceCount;
      stored += sourceCount;
    } catch (error) { report[source] = error instanceof Error ? error.message.slice(0, 120) : "Ingestion failed"; }
  }
  return { stored, sources: report };
}

export async function sitemapNoticeRows(db?: D1Database): Promise<{ source: string; notice_id: string; updated_at: string | null; published_at: string | null }[]> {
  if (!db) return [];
  try {
    const rows = await db.prepare(`SELECT source, notice_id, updated_at, published_at FROM notices
      WHERE title <> 'Untitled notice' AND buyer IS NOT NULL AND url IS NOT NULL
        AND (deadline_at IS NOT NULL OR value IS NOT NULL OR cpv <> '[]')
      ORDER BY COALESCE(updated_at, published_at) DESC LIMIT 50000`).all<{ source: string; notice_id: string; updated_at: string | null; published_at: string | null }>();
    return rows.results;
  } catch { return []; }
}

export async function sitemapHubRows(db?: D1Database): Promise<{ country: string; division: string; lastmod: string | null }[]> {
  if (!db) return [];
  try {
    const rows = await db.prepare(`SELECT n.country AS country, substr(j.value, 1, 2) || '000000' AS division,
      MAX(COALESCE(n.updated_at, n.published_at)) AS lastmod FROM notices n, json_each(n.cpv) j
      WHERE n.country IS NOT NULL AND COALESCE(n.published_at, n.updated_at) >= date('now', '-30 days')
      GROUP BY n.country, division HAVING COUNT(DISTINCT n.id) >= 5 LIMIT 10000`).all<{ country: string; division: string; lastmod: string | null }>();
    return rows.results;
  } catch { return []; }
}

/**
 * Countries (ISO3) and CPV divisions with at least 5 notices in the last 30 days: the same window and
 * threshold the country and CPV pages use before they allow indexing. Null when the store is unavailable.
 */
export async function sitemapListingCoverage(db?: D1Database): Promise<{ countries: Set<string>; divisions: Set<string> } | null> {
  if (!db) return null;
  try {
    const recent = `COALESCE(published_at, updated_at) >= date('now', '-30 days')`;
    const [countries, divisions] = await Promise.all([
      db.prepare(`SELECT country AS k FROM notices WHERE country IS NOT NULL AND ${recent} GROUP BY country HAVING COUNT(*) >= 5`).all<{ k: string }>(),
      db.prepare(`SELECT substr(j.value, 1, 2) || '000000' AS k FROM notices n, json_each(n.cpv) j
        WHERE ${recent.replace(/published_at|updated_at/g, (c) => `n.${c}`)} GROUP BY k HAVING COUNT(DISTINCT n.source || ':' || n.notice_id) >= 5`).all<{ k: string }>(),
    ]);
    return { countries: new Set(countries.results.map((r) => r.k)), divisions: new Set(divisions.results.map((r) => r.k)) };
  } catch { return null; }
}

/**
 * Up to `limit` stored notices related to one tender: other notices from the same buyer first, then
 * open notices in the same country and CPV division. Excludes the tender itself. Empty when D1 is unavailable.
 */
export async function relatedStored(n: { source: string; noticeId: string; buyer: string | null; country: string | null; cpv: string[] }, db?: D1Database, limit = 6): Promise<Notice[]> {
  if (!db) return [];
  try {
    const self = `${n.source}:${n.noticeId}`;
    const seen = new Set([self]);
    const out: Notice[] = [];
    const take = (rows: { payload: string; value_eur: number | null }[]) => {
      for (const r of rows) { const x = rowNotice(r); const k = `${x.source}:${x.noticeId}`; if (!seen.has(k) && out.length < limit) { seen.add(k); out.push(x); } }
    };
    if (n.buyer) {
      const rows = await db.prepare("SELECT payload, value_eur FROM notices WHERE buyer_slug = ? ORDER BY published_at DESC LIMIT 8").bind(buyerSlug(n.buyer)).all<{ payload: string; value_eur: number | null }>();
      take(rows.results);
    }
    const division = n.cpv[0]?.slice(0, 2);
    if (out.length < limit && n.country) {
      const rows = division
        ? await db.prepare(`SELECT n.payload, n.value_eur FROM notices n WHERE n.country = ? AND n.status = 'open'
            AND EXISTS (SELECT 1 FROM json_each(n.cpv) j WHERE substr(j.value, 1, 2) = ?) ORDER BY n.published_at DESC LIMIT 12`).bind(n.country, division).all<{ payload: string; value_eur: number | null }>()
        : await db.prepare("SELECT payload, value_eur FROM notices WHERE country = ? AND status = 'open' ORDER BY published_at DESC LIMIT 12").bind(n.country).all<{ payload: string; value_eur: number | null }>();
      take(rows.results);
    }
    return out;
  } catch { return []; }
}

export interface BuyerSummary { slug: string; name: string; count: number; open: number; countries: number }
export interface BuyerProfile extends BuyerSummary { notices: Notice[]; categories: { code: string; count: number }[]; disclosedValueEur: number | null }

export async function listStoredBuyers(db: D1Database | undefined, limit = 200): Promise<BuyerSummary[] | null> {
  if (!db) return null;
  try {
    const rows = await db.prepare(`SELECT buyer_slug AS slug, buyer AS name, COUNT(*) AS count,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open,
      COUNT(DISTINCT country) AS countries FROM notices WHERE buyer IS NOT NULL AND buyer_slug IS NOT NULL
      GROUP BY buyer_slug, buyer ORDER BY count DESC, buyer LIMIT ?`).bind(limit).all<BuyerSummary>();
    return rows.results;
  } catch { return null; }
}

export async function storedBuyer(slug: string, db?: D1Database): Promise<BuyerProfile | null> {
  if (!db) return null;
  try {
    const rows = await db.prepare("SELECT payload, value_eur FROM notices WHERE buyer_slug = ? ORDER BY published_at DESC LIMIT 5000").bind(slug).all<{ payload: string; value_eur: number | null }>();
    if (!rows.results.length) return null;
    const notices = rows.results.map(rowNotice);
    const first = notices[0]!;
    const categoryCounts = new Map<string, number>();
    let value = 0; let hasValue = false;
    for (const n of notices) {
      for (const code of n.cpv) { const division = `${code.slice(0, 2)}000000`; categoryCounts.set(division, (categoryCounts.get(division) ?? 0) + 1); }
      if (n.valueEur != null) { value += n.valueEur; hasValue = true; }
    }
    return { slug, name: first.buyer!, count: notices.length, open: notices.filter((n) => n.status === "open").length,
      countries: new Set(notices.map((n) => n.country).filter(Boolean)).size, notices: notices.slice(0, 100),
      categories: [...categoryCounts].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count).slice(0, 8),
      disclosedValueEur: hasValue ? Math.round(value) : null };
  } catch { return null; }
}
