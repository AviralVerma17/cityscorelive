'use strict';

require('dotenv').config();

/**
 * Central, validated place for every environment-driven setting.
 * Nothing else in the codebase should read `process.env` directly —
 * that keeps configuration auditable and easy to mock in tests.
 */
const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toList = (value, fallback) => {
  if (!value) return fallback;
  return value.split(',').map((v) => v.trim()).filter(Boolean);
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 4000),

  db: {
    file: process.env.DB_FILE || './data/cityscore.db',
  },

  cors: {
    allowedOrigins: toList(process.env.ALLOWED_ORIGINS, ['http://localhost:8000', 'http://127.0.0.1:8000']),
  },

  rateLimit: {
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    maxRequests: toInt(process.env.RATE_LIMIT_MAX, 300),
    submissionWindowMs: toInt(process.env.SUBMISSION_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000),
    submissionMax: toInt(process.env.SUBMISSION_RATE_LIMIT_MAX, 10),
  },

  environment: {
    // If both keys are present, the environment service calls the real
    // APIs. Otherwise it falls back to a deterministic seeded generator
    // so the product still behaves like a live feed end to end.
    openWeatherApiKey: process.env.OPENWEATHER_API_KEY || null,
    aqicnApiKey: process.env.AQICN_API_KEY || null,
    refreshIntervalMinutes: toInt(process.env.ENVIRONMENT_REFRESH_MINUTES, 20),
  },

  weights: {
    // Fixed-source signals
    weather: 0.15,
    airQuality: 0.20,
    // Crowd-submitted signals
    safety: 0.20,
    traffic: 0.15,
    transport: 0.15,
    cleanliness: 0.15,
  },

  // Same six categories, reweighted per audience. Applied instead of
  // the default `weights` above when a request passes ?mode=<key>.
  // Each profile's weights sum to 1, same as the default. This is the
  // single source of truth for mode scoring — the frontend keeps a
  // matching copy (frontend/js/modes.js) only for its offline
  // fallback view, never as the source of truth for a live request.
  modeWeights: {
    family: {
      weather: 0.10, airQuality: 0.25,
      safety: 0.30, traffic: 0.10, transport: 0.10, cleanliness: 0.15,
    },
    professional: {
      weather: 0.10, airQuality: 0.10,
      safety: 0.15, traffic: 0.25, transport: 0.30, cleanliness: 0.10,
    },
    student: {
      weather: 0.10, airQuality: 0.15,
      safety: 0.20, traffic: 0.10, transport: 0.25, cleanliness: 0.20,
    },
  },

  // Used whenever a request omits ?mode= or passes an unrecognized
  // one — matches the frontend's own default (frontend/js/modes.js).
  defaultMode: 'family',

  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
};

module.exports = config;
