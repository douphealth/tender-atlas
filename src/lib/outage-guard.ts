// Outage guard (runs in src/server.ts after a page is rendered).
//
// When the database stops answering, a tender page whose live publisher lookup also fails renders as
// "not found" (404), and a listing page falls back to a thin live result and marks itself noindex.
// Both tell a crawler the page is gone or unwanted, when it is only unavailable for a few hours.
// While the database is failing, those two answers go out as 503 with Retry-After instead: the visitor
// still sees the same page, and a crawler keeps what it has and comes back later.
// Self-contained on purpose: the server entry is bundled apart from the app and should stay small.

type Probe = { prepare(sql: string): { first(): Promise<unknown> } };

/** Pages that are indexable when healthy: tenders, country, CPV and country x CPV listings, buyers. */
const GUARDED = /^\/(?:tenders\/[^/]+\/[^/]+|countries\/[^/]+\/tenders|countries\/[^/]+\/cpv\/[^/]+|cpv\/[^/]+|buyers\/[^/]+)$/;
const ROBOTS_META = /<meta\b[^>]*\bname=["']robots["'][^>]*>/i;

const health = new WeakMap<object, { at: number; ok: boolean }>();
/**
 * Whether the configured database answers: null without one. Remembered per isolate for 60 s when it
 * answers and 20 s when it does not, and costs one indexed row (migration 0003) when it runs.
 * `fresh` skips a remembered "it answers": used before a 404 goes out, which is rare and must not be wrong.
 */
export async function databaseAnswers(db: Probe | undefined, fresh = false, now = Date.now()): Promise<boolean | null> {
  if (!db) return null;
  const known = health.get(db);
  if (known && !(fresh && known.ok) && now - known.at < (known.ok ? 60_000 : 20_000)) return known.ok;
  let ok = true;
  try { await db.prepare("SELECT MAX(last_seen_at) AS fresh FROM notices").first(); } catch { ok = false; }
  health.set(db, { at: now, ok });
  return ok;
}

export const isGuardedPath = (pathname: string) => GUARDED.test(pathname);

export async function guardOutage(request: Request, response: Response, answers: (fresh: boolean) => Promise<boolean | null>): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return response;
  if (!isGuardedPath(new URL(request.url).pathname)) return response;
  const html = (response.headers.get("content-type") ?? "").includes("text/html");
  if (response.status !== 404 && !(response.status === 200 && html)) return response;
  // Healthy, or no database configured: the answer stands. The page is only read during an outage.
  if ((await answers(response.status === 404)) !== false) return response;
  if (response.status === 200) {
    const tag = (await response.clone().text()).match(ROBOTS_META)?.[0] ?? "";
    if (!/noindex/i.test(tag)) return response;
  }
  const headers = new Headers(response.headers);
  headers.set("retry-after", "3600");
  headers.set("cache-control", "no-store");
  headers.set("x-outage-guard", "database-unavailable");
  return new Response(response.body, { status: 503, headers });
}
