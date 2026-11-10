-- Rate-limit paid semantic analysis to contain AI inference costs.
CREATE TABLE IF NOT EXISTS ai_usage (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day TEXT NOT NULL,
 used INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,day)
);
