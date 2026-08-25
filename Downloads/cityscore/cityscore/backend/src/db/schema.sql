-- CityScore schema
-- SQLite via Node's built-in node:sqlite module. Kept intentionally small and normalized:
-- cities are static reference data, submissions are the append-only
-- log of crowd input, and environment_readings is a cache of the
-- fixed-source signal so we don't hit external APIs on every request.

CREATE TABLE IF NOT EXISTS cities (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  state         TEXT,
  country       TEXT NOT NULL,
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  population    INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per city, updated in place. Running averages live here
-- rather than being recomputed from the full submissions table on
-- every read, which keeps GET /cities cheap as submissions grow.
CREATE TABLE IF NOT EXISTS category_scores (
  city_id           INTEGER PRIMARY KEY REFERENCES cities(id) ON DELETE CASCADE,
  safety_avg        REAL NOT NULL DEFAULT 0,
  traffic_avg       REAL NOT NULL DEFAULT 0,
  transport_avg     REAL NOT NULL DEFAULT 0,
  cleanliness_avg   REAL NOT NULL DEFAULT 0,
  submission_count  INTEGER NOT NULL DEFAULT 0,
  updated_at        TEXT
);

-- Append-only log of every rating submitted. Never overwritten or
-- deleted in normal operation, so category_scores can always be
-- recomputed/audited from this table if needed.
CREATE TABLE IF NOT EXISTS submissions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id         INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  safety          REAL NOT NULL,
  traffic         REAL NOT NULL,
  transport       REAL NOT NULL,
  cleanliness     REAL NOT NULL,
  comment         TEXT,
  submitter_hash  TEXT NOT NULL, -- salted hash of IP, never the raw IP
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_city_id ON submissions(city_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);

-- Cache of the fixed-source (weather + air quality) signal. One row
-- per city, overwritten on each refresh cycle by the cron job in
-- jobs/refreshEnvironment.js.
CREATE TABLE IF NOT EXISTS environment_readings (
  city_id       INTEGER PRIMARY KEY REFERENCES cities(id) ON DELETE CASCADE,
  temp_c        REAL,
  weather_score REAL NOT NULL,
  aqi           REAL,
  air_quality_score REAL NOT NULL,
  source        TEXT NOT NULL DEFAULT 'seed', -- 'seed' | 'live'
  fetched_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lightweight per-IP-hash, per-city submission throttle, enforced at
-- the application layer in addition to the express-rate-limit window,
-- so one contributor can't quietly dominate a city's average.
CREATE TABLE IF NOT EXISTS submission_throttle (
  submitter_hash  TEXT NOT NULL,
  city_id         INTEGER NOT NULL,
  last_submitted_at TEXT NOT NULL,
  PRIMARY KEY (submitter_hash, city_id)
);
