-- Apply via Cloudflare D1 SQL console or wrangler d1 execute before enabling account features.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  stripe_customer_id TEXT UNIQUE, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_challenges (
  id TEXT PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE,
  code_hash TEXT NOT NULL, ip_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_challenges_email ON login_challenges(email,created_at);
CREATE INDEX IF NOT EXISTS idx_challenges_ip ON login_challenges(ip_hash,created_at);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS company_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
  keywords TEXT NOT NULL DEFAULT '[]', countries TEXT NOT NULL DEFAULT '[]',
  cpv_codes TEXT NOT NULL DEFAULT '[]', updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS saved_notices (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notice_id TEXT NOT NULL, title TEXT NOT NULL, source TEXT NOT NULL,
  source_url TEXT NOT NULL, summary_json TEXT NOT NULL,
  saved_at INTEGER NOT NULL, PRIMARY KEY (user_id,notice_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_notices(user_id,saved_at DESC);
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  term TEXT NOT NULL, country TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'ted',
  enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL,
  last_checked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE, stripe_customer_id TEXT,
  stripe_price_id TEXT, status TEXT NOT NULL DEFAULT 'inactive',
  tier TEXT NOT NULL DEFAULT 'free', updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY, handled_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS alert_deliveries (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, alert_id TEXT NOT NULL,
  notice_id TEXT NOT NULL, delivered_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries ON alert_deliveries(alert_id,delivered_at);
