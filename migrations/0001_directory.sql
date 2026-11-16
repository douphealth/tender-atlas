PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  notice_id TEXT NOT NULL,
  title TEXT NOT NULL,
  buyer TEXT,
  buyer_slug TEXT,
  country TEXT,
  published_at TEXT,
  updated_at TEXT,
  deadline_at TEXT,
  value REAL,
  currency TEXT,
  value_eur REAL,
  cpv TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  url TEXT,
  payload TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE(source, notice_id)
);
CREATE INDEX IF NOT EXISTS notices_search_idx ON notices(published_at DESC, source, country);
CREATE INDEX IF NOT EXISTS notices_deadline_idx ON notices(deadline_at);
CREATE INDEX IF NOT EXISTS notices_value_idx ON notices(value_eur);
CREATE INDEX IF NOT EXISTS notices_buyer_idx ON notices(buyer_slug, published_at DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS notices_fts USING fts5(title, buyer, description, content='notices', content_rowid='rowid');
CREATE TRIGGER IF NOT EXISTS notices_ai AFTER INSERT ON notices BEGIN
  INSERT INTO notices_fts(rowid, title, buyer, description) VALUES (new.rowid, new.title, new.buyer, json_extract(new.payload, '$.description'));
END;
CREATE TRIGGER IF NOT EXISTS notices_ad AFTER DELETE ON notices BEGIN
  INSERT INTO notices_fts(notices_fts, rowid, title, buyer, description) VALUES ('delete', old.rowid, old.title, old.buyer, json_extract(old.payload, '$.description'));
END;
CREATE TRIGGER IF NOT EXISTS notices_au AFTER UPDATE ON notices BEGIN
  INSERT INTO notices_fts(notices_fts, rowid, title, buyer, description) VALUES ('delete', old.rowid, old.title, old.buyer, json_extract(old.payload, '$.description'));
  INSERT INTO notices_fts(rowid, title, buyer, description) VALUES (new.rowid, new.title, new.buyer, json_extract(new.payload, '$.description'));
END;

CREATE TABLE IF NOT EXISTS dossier_requests (
  id TEXT PRIMARY KEY,
  notice TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  query TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  verify_token_hash TEXT NOT NULL,
  unsubscribe_token_hash TEXT NOT NULL,
  unsubscribe_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(email, query)
);
CREATE TABLE IF NOT EXISTS alert_deliveries (
  subscription_id TEXT NOT NULL,
  notice_id TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY(subscription_id, notice_id)
);
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TEXT NOT NULL
);
