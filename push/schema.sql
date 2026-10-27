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

-- تنبيهات بتتكرر كل دقيقة لحد ما العميل يرد
CREATE TABLE IF NOT EXISTS alerts (
  endpoint  TEXT NOT NULL,
  k         TEXT NOT NULL,
  name      TEXT NOT NULL,
  tries     INTEGER NOT NULL,
  repeat_at INTEGER NOT NULL,
  PRIMARY KEY (endpoint, k)
);
CREATE INDEX IF NOT EXISTS idx_alert ON alerts(repeat_at);

-- عدّاد قراءات الصور بالذكاء الاصطناعي (حد لكل جهاز في الساعة)
CREATE TABLE IF NOT EXISTS rl (
  k  TEXT PRIMARY KEY,
  hr INTEGER NOT NULL,
  n  INTEGER NOT NULL
);
