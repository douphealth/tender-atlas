CREATE TABLE dossier_orders (
  id TEXT PRIMARY KEY REFERENCES dossier_requests(id),
  access_token_hash TEXT NOT NULL,
  offer_version TEXT NOT NULL,
  notice_snapshot TEXT NOT NULL,
  focus TEXT NOT NULL DEFAULT '',
  terms_accepted_at TEXT NOT NULL,
  expected_amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  stripe_session_id TEXT UNIQUE,
  checkout_url TEXT,
  checkout_payload TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  paid_at TEXT,
  owner_notified_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX dossier_orders_queue_idx ON dossier_orders(payment_status, paid_at);