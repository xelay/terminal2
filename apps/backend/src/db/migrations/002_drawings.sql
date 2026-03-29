CREATE TABLE IF NOT EXISTS drawings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange    TEXT NOT NULL,
  symbol      TEXT NOT NULL,
  timeframe   TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'brush',
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drawings_lookup
  ON drawings (user_id, exchange, symbol, timeframe);
