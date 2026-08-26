# CityScore

A live city-rating dashboard: a dark instrument-panel map, an overall
0&ndash;100 score per city on an analog gauge, and six weighted category
scores underneath it. The frontend is a dependency-free static app;
the backend is a real Node/Express API with a SQLite-backed database,
running weighted averages, rate limiting, and a scheduled job that
refreshes environmental data on an interval.

```
Frontend (static, no build step)  <-->  Backend API (Express + SQLite)  <-->  Weather/AQI providers
     dark interactive map + gauge         scoring, submissions, cron          (or seed mode, no keys needed)
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
- **Map** &mdash; a real, pannable/zoomable dark map (Leaflet + free
  CARTO dark tiles, no API key needed), so country borders and place
  names are genuine geography, not a stylized grid. Cities are
  plotted by latitude/longitude and colored by score band; hover a
  dot for its name, state/country, and score. Zoom and drag are
  scoped to the map, not the page.
- **Bottom-right** &mdash; the six category cards, each showing its
  score, weight, and either contributor count (crowd categories) or
  the raw reading and last-refresh time (fixed-source categories).
- **Search** &mdash; manual city/state search in the header. No
  geolocation &mdash; you find your city, it doesn't guess.
- **Rate this city** &mdash; a form for the four subjective categories,
  scoped to whichever mode you're currently viewing. Each mode keeps
  its own running average per city &mdash; rating a city under
  Student mode doesn't touch its Professional or Family numbers, and
  you can rate the same city once per mode per hour (up to 10
  submissions/hour total per person, across any cities/modes).
- **How this is calculated** &mdash; pulls the live weighting table
  and explanation straight from `GET /api/methodology`, so it can
  never drift out of sync with the actual scoring code.
- **Mode switch** (top-center) &mdash; a frosted-glass pill that
  toggles between **Student**, **Professional**, and **Family**
  views. Weather/air quality stay the same across modes (they're the
  fixed-source signal), but safety, traffic, transport, and
  cleanliness are rated **independently per mode** &mdash; a
  student's take on a city's safety can genuinely differ from a
  family's, so each mode blends its own running average
  (`mode_category_scores` table) on top of its own weight profile
  (`GET /api/cities?mode=professional`, etc. — see
  `backend/src/config/index.js`'s `modeWeights`). Switching modes
  triggers a short blur/scale "morph" on the score and category
  panels while the mode-specific data loads.
- **Rankings** &mdash; a full leaderboard of every city sorted by
  overall score for whichever mode is active, with an inline star to
  favorite a city straight from the list.
- **Best for me** (bottom-left) &mdash; set your own relative
  priorities across all six categories with a slider dialog; cities
  are ranked by that custom weighting instead of any fixed mode. Top
  5 show inline, "Load more" opens a paginated (10/page) full ranking.
  Entirely client-side — it re-weighs whatever category scores are
  already loaded for the active mode.
- **Favorites** &mdash; a star toggle on the score panel (and inside
  Rankings/Best for me) saves a city locally; the header's Favorites
  button opens the saved list. Stored in `localStorage`, per browser,
  since this is a personal preference rather than something that
  needs an account or backend.

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
- **Running averages, not raw replays** &mdash; `mode_category_scores`
  holds the current average per (city, mode) pair; `submissions` is
  an append-only log (tagged with the mode it was rated under)
  everything is derived from, so any average can always be audited or
  recomputed.
- **Abuse resistance** &mdash; `express-rate-limit` caps a submitter
  at 10 ratings/hour globally, *and* an application-level
  per-submitter-per-city-**per-mode** throttle (`submission_throttle`)
  blocks re-rating the same city under the same mode within an hour —
  while still allowing a genuinely separate rating of that city under
  a different mode. IPs are never stored raw &mdash; only a salted
  hash.
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
      data/cities.json        18 seeded cities (8 US, 10 India — name, coords, baseline scores)
    tests/                    Jest + Supertest
    openapi.yaml              Full API spec
    Dockerfile
  frontend/
    index.html                Page structure, rating modal, methodology panel
    css/style.css              Dark instrument-panel theme
    js/
      api.js                  Backend client with offline fallback
      map.js                   Leaflet-based interactive map renderer
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
4. Expand past the 18 seeded cities once both data paths have proven
   themselves in a real deployment.
