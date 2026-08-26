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

-- The four subjective categories are rated PER MODE, not once
-- globally: a student's take on a city's safety/traffic/transport/
-- cleanliness can genuinely differ from a family's or a working
-- professional's, so each (city, mode) pair gets its own running
-- averages. Weather/air quality aren't here because they're the
-- fixed-source signal, not subjective, and don't vary by mode.
CREATE TABLE IF NOT EXISTS mode_category_scores (
  city_id           INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  mode              TEXT NOT NULL CHECK (mode IN ('student', 'professional', 'family')),
  safety_avg        REAL NOT NULL DEFAULT 0,
  traffic_avg       REAL NOT NULL DEFAULT 0,
  transport_avg     REAL NOT NULL DEFAULT 0,
  cleanliness_avg   REAL NOT NULL DEFAULT 0,
  submission_count  INTEGER NOT NULL DEFAULT 0,
  updated_at        TEXT,
  PRIMARY KEY (city_id, mode)
);

-- Append-only log of every rating submitted, tagged with the mode it
-- was submitted under. Never overwritten or deleted in normal
-- operation, so mode_category_scores can always be recomputed/audited
-- from this table if needed.
CREATE TABLE IF NOT EXISTS submissions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  city_id         INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  mode            TEXT NOT NULL CHECK (mode IN ('student', 'professional', 'family')),
  safety          REAL NOT NULL,
  traffic         REAL NOT NULL,
  transport       REAL NOT NULL,
  cleanliness     REAL NOT NULL,
  comment         TEXT,
  submitter_hash  TEXT NOT NULL, -- salted hash of IP, never the raw IP
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_city_mode ON submissions(city_id, mode);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);

-- Cache of the fixed-source (weather + air quality) signal. One row
-- per city (not per mode — this signal doesn't vary by audience),
-- overwritten on each refresh cycle by the cron job in
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

-- Per-mode submission throttle: a submitter can rate the same city
-- once per mode per window, rather than being blocked from rating it
-- again just because they already rated it under a different mode.
-- Rating Kolkata for "student" and then for "professional" are two
-- independent, valid submissions.
CREATE TABLE IF NOT EXISTS submission_throttle (
  submitter_hash    TEXT NOT NULL,
  city_id           INTEGER NOT NULL,
  mode              TEXT NOT NULL CHECK (mode IN ('student', 'professional', 'family')),
  last_submitted_at TEXT NOT NULL,
  PRIMARY KEY (submitter_hash, city_id, mode)
);
