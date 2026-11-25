-- Read-cost indexes. D1 bills (and on the free plan caps) rows read, so full scans of `notices`
-- on every page view exhausted the account's daily limit (`wrangler d1 insights tender-atlas`).

-- Freshness check (store.ts usableDb): MAX(last_seen_at) becomes a one-row index seek
-- instead of a full table scan on every stored search.
CREATE INDEX IF NOT EXISTS notices_last_seen_idx ON notices(last_seen_at);

-- Related tenders (same country, open, newest first) and country-filtered listings:
-- walk one country's notices in date order instead of scanning the whole table.
CREATE INDEX IF NOT EXISTS notices_country_idx ON notices(country, published_at DESC);

-- Refresh planner statistics so the new indexes are chosen (Cloudflare's D1 index guidance).
PRAGMA optimize;
