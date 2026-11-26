-- Small key/value store for documents that are expensive to compute and change only at ingest.
-- First use: the XML sitemap. Building it scans `notices` four times (D1 bills rows read, and the
-- free plan caps them per account per day); reading the stored copy costs a handful of rows.
CREATE TABLE IF NOT EXISTS site_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
