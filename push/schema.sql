CREATE TABLE IF NOT EXISTS subs (
  endpoint TEXT PRIMARY KEY,
  p256dh   TEXT NOT NULL,
  auth     TEXT NOT NULL,
  updated  INTEGER
);
CREATE TABLE IF NOT EXISTS reminders (
  id       TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  name     TEXT NOT NULL,
  a        INTEGER NOT NULL,
  step     INTEGER NOT NULL,
  ends     INTEGER NOT NULL,
  next_due INTEGER,
  PRIMARY KEY (endpoint, id)
);
CREATE INDEX IF NOT EXISTS idx_due ON reminders(next_due);
