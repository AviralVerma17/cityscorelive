# CityScore

A live city-rating dashboard: a dark instrument-panel map, an overall
0&ndash;100 score per city on an analog gauge, and six weighted category
scores underneath it. The frontend is a dependency-free static app;
the backend is a real Node/Express API with a SQLite-backed database,
running weighted averages, rate limiting, and a scheduled job that
refreshes environmental data on an interval.

```
Frontend (static, no build step)  <-->  Backend API (Express + SQLite)  <-->  Weather/AQI providers
     dark radar map + gauge              scoring, submissions, cron          (or seed mode, no keys needed)
```

## Why two data paths

A city's score is a weighted blend of six categories, split into two
kinds of signal:

| Category | Weight | Source |
|---|---|---|
| Air quality | 20% | Fixed monitoring feed (AQICN-style), cached & refreshed every 20 min |
| Safety | 20% | Resident/visitor submitted |
| Weather | 15% | Fixed monitoring feed (OpenWeatherMap-style), cached & refreshed every 20 min |
| Traffic | 15% | Resident/visitor submitted |
| Public transport | 15% | Resident/visitor submitted |
| Cleanliness | 15% | Resident/visitor submitted |

**35%** comes from a fixed source polled on an interval (polling 20+
cities in real time gets expensive fast, and conditions don't change
minute to minute anyway). **65%** comes from the crowd, blended into a
running average per category so a single submission can't swing a
city's score &mdash; see `backend/src/services/scoringService.js` for
the exact math, or hit `GET /api/methodology` to see the same weights
the app renders in its "How this is calculated" panel.

No live API keys are required to run this. Without
`OPENWEATHER_API_KEY` / `AQICN_API_KEY` set, the backend generates
deterministic, slowly-drifting seed values with the same shape live
data would have, and labels every reading `source: "seed"` end to end
so the UI never claims to be live when it isn't. Add both keys and it
switches to real calls automatically.

## Running it

### Quick start (two terminals, no Docker)

```bash
# Terminal 1 — API
cd backend
cp .env.example .env
npm install
npm run seed   # loads the 20 starter cities (idempotent, safe to re-run)
npm run dev

# Terminal 2 — frontend
cd frontend
python3 -m http.server 8000
```

Visit `http://localhost:8000`. The frontend talks to `http://localhost:4000/api`
by default (see `frontend/js/config.js`) and falls back to a small
local seed dataset if it can't reach the API at all, so the UI is
still browsable with only the frontend running.

### Docker Compose (backend + frontend together)

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

Frontend on `http://localhost:8080`, API on `http://localhost:4000`.

### Tests

```bash
cd backend
npm test
```

Covers the scoring math (temperature/AQI curves, running-average
blending, overall-score weighting) and the main API routes end to end
with Supertest against a throwaway SQLite file.

## What's in the UI

- **Top-left, on the map** &mdash; an analog gauge showing the overall
  score (0&ndash;100) and the selected city's name. A "seed data" badge
  shows while a city hasn't had any real submissions yet.
- **Map** &mdash; a dark, dependency-free radar-style map (no tile
  server or API key needed): cities are plotted by latitude/longitude
  and colored by score band. Click or tap a marker, or use search.
- **Bottom-right** &mdash; the six category cards, each showing its
  score, weight, and either contributor count (crowd categories) or
  the raw reading and last-refresh time (fixed-source categories).
- **Search** &mdash; manual city/state search in the header. No
  geolocation &mdash; you find your city, it doesn't guess.
- **Rate this city** &mdash; a form for the four subjective categories.
  A submission blends into that category's running average via the
  real `POST /api/cities/:slug/submissions` endpoint, throttled per
  submitter per city so one person can't swing a score alone.
- **How this is calculated** &mdash; pulls the live weighting table
  and explanation straight from `GET /api/methodology`, so it can
  never drift out of sync with the actual scoring code.

## API overview

Full detail in [`backend/openapi.yaml`](backend/openapi.yaml).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check |
| GET | `/api/cities` | List all cities with current scores |
| GET | `/api/cities/:slug` | Single city detail |
| POST | `/api/cities/:slug/submissions` | Submit a rating (rate-limited) |
| GET | `/api/cities/:slug/submissions` | Recent submissions, paginated |
| POST | `/api/cities/:slug/environment/refresh` | Force a weather/AQI refresh |
| GET | `/api/methodology` | Weights + plain-language explanation |

## Backend design notes

- **SQLite via Node's built-in `node:sqlite` module** &mdash; synchronous,
  zero external services to stand up, and (since it ships with Node
  itself) no native addon to compile &mdash; nothing to install beyond
  Node. Requires **Node 22.5+** (`node -v` to check). All SQL lives
  behind the two repositories in `src/models/`, so swapping to
  Postgres later only touches that layer.
- **Running averages, not raw replays** &mdash; `category_scores` holds
  the current average per city; `submissions` is an append-only log
  everything is derived from, so the average can always be audited or
  recomputed.
- **Abuse resistance** &mdash; `express-rate-limit` on every route,
  a stricter limit on submissions, *and* an application-level
  per-submitter-per-city throttle (`submission_throttle`) so the two
  layers cover both bursty and slow-and-steady abuse. IPs are never
  stored raw &mdash; only a salted hash.
- **Validation** &mdash; every request body/query is parsed through a
  `zod` schema before it reaches a controller.
- **Single source of truth for scoring** &mdash; `scoringService.js`
  is pure and side-effect free; both the actual score calculation and
  the `/methodology` endpoint the frontend renders read from it, so
  the number and the explanation can't drift apart.
- **Environment job** &mdash; `jobs/refreshEnvironment.js` runs once at
  boot and then on a configurable cron schedule, refreshing every
  city's weather/AQI reading in one place regardless of whether it's
  hitting real APIs or generating seed values.

## Files

```
cityscore/
  backend/
    src/
      app.js                Express app: middleware, routes, error handling
      server.js              Entry point: boots DB, seeds, schedules cron, listens
      config/index.js        All env vars read in exactly one place
      db/                    SQLite connection, schema.sql, idempotent seed script
      models/                All SQL: city + submission repositories
      services/               scoringService (pure math), environmentService (live/seed)
      controllers/            Request handling for cities + submissions
      routes/                  Route wiring
      middleware/              errorHandler, rateLimiter, validate
      jobs/refreshEnvironment.js  Scheduled weather/AQI refresh
      data/cities.json        20 seeded cities (name, coords, baseline scores)
    tests/                    Jest + Supertest
    openapi.yaml              Full API spec
    Dockerfile
  frontend/
    index.html                Page structure, rating modal, methodology panel
    css/style.css              Dark instrument-panel theme
    js/
      api.js                  Backend client with offline fallback
      map.js                   Dependency-free radar map renderer
      gauge.js                 Analog score dial renderer
      app.js                   Wires it all together
      data.js / config.js      Local fallback data + API base config
  docker-compose.yml
  LICENSE
```

## Next steps if you keep building this

1. Swap in real `OPENWEATHER_API_KEY` / `AQICN_API_KEY` values and
   confirm the "seed" &rarr; "live" badge flips as expected.
2. Add an admin/moderation view over `submissions` for flagged
   comments before they ever need to go fully public.
3. Move from SQLite to Postgres if this needs to run across multiple
   backend instances (the repository layer is already the only place
   that would need to change).
4. Expand past the 20 seeded cities once both data paths have proven
   themselves in a real deployment.
