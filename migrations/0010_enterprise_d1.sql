-- TenderAtlas v10.5 Enterprise D1 Schema
CREATE TABLE IF NOT EXISTS procurement_processes (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  ocid TEXT,
  title TEXT NOT NULL,
  buyer TEXT,
  country TEXT,
  stage TEXT NOT NULL DEFAULT 'unknown',
  status TEXT NOT NULL DEFAULT 'unknown',
  published_at TEXT,
  updated_at TEXT,
  deadline_at TEXT,
  deadline_raw TEXT,
  deadline_timezone TEXT,
  value REAL,
  currency TEXT,
  cpv_json TEXT DEFAULT '[]',
  lots_json TEXT DEFAULT '[]',
  url TEXT,
  provenance TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notice_releases (
  id TEXT PRIMARY KEY,
  process_id TEXT NOT NULL,
  release_date TEXT,
  content_hash TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS source_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  fetched_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  ran_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stripe_customer_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  query_json TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily',
  last_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
