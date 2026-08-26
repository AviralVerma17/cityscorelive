'use strict';

const cityRepository = require('../models/cityRepository');
const environmentService = require('../services/environmentService');
const { computeOverallScore } = require('../services/scoringService');
const { ApiError } = require('../middleware/errorHandler');
const config = require('../config');

const VALID_MODES = new Set(Object.keys(config.modeWeights));

/**
 * Resolves a ?mode= query value to a concrete mode key + its weight
 * profile. There's no longer a "neutral" mode-agnostic view — every
 * request needs a concrete mode to know both which weight profile to
 * apply and which mode_category_scores row to read. An unknown or
 * absent mode falls back to the app's default mode rather than
 * erroring, so a bad/missing mode never breaks the page.
 */
function resolveMode(modeParam) {
  const mode = VALID_MODES.has(modeParam) ? modeParam : config.defaultMode;
  return { mode, weights: config.modeWeights[mode] };
}

function serializeCity(row, mode, weights) {
  const categories = {
    weather: { score: row.weather_score ?? 0, label: 'Weather' },
    airQuality: { score: row.air_quality_score ?? 0, label: 'Air quality' },
    safety: { score: row.safety_avg ?? 0, label: 'Safety' },
    traffic: { score: row.traffic_avg ?? 0, label: 'Traffic' },
    transport: { score: row.transport_avg ?? 0, label: 'Public transport' },
    cleanliness: { score: row.cleanliness_avg ?? 0, label: 'Cleanliness' },
  };

  const overall = computeOverallScore(
    {
      weather: categories.weather.score,
      airQuality: categories.airQuality.score,
      safety: categories.safety.score,
      traffic: categories.traffic.score,
      transport: categories.transport.score,
      cleanliness: categories.cleanliness.score,
    },
    weights
  );

  return {
    slug: row.slug,
    name: row.name,
    state: row.state,
    country: row.country,
    lat: row.lat,
    lng: row.lng,
    population: row.population,
    mode,
    overallScore: overall,
    isSeedData: (row.submission_count ?? 0) === 0,
    contributorCount: row.submission_count ?? 0,
    categories,
    environment: {
      tempC: row.temp_c,
      aqi: row.aqi,
      source: row.environment_source || 'seed',
      fetchedAt: row.fetched_at,
    },
  };
}

function listCities(req, res) {
  const { mode, weights } = resolveMode(req.query.mode);
  const rows = cityRepository.listCities(mode);
  res.json({ mode, cities: rows.map((row) => serializeCity(row, mode, weights)) });
}

function getCity(req, res) {
  const { mode, weights } = resolveMode(req.query.mode);
  const row = cityRepository.getCityBySlug(req.params.slug, mode);
  if (!row) throw new ApiError(404, `No city found for slug "${req.params.slug}"`);
  res.json({ city: serializeCity(row, mode, weights) });
}

async function refreshEnvironment(req, res) {
  const cityRow = cityRepository.getCityBySlug(req.params.slug, config.defaultMode);
  if (!cityRow) throw new ApiError(404, `No city found for slug "${req.params.slug}"`);

  const reading = await environmentService.refreshCity(cityRow);
  res.json({
    slug: cityRow.slug,
    tempC: reading.temp_c,
    aqi: reading.aqi,
    weatherScore: reading.weather_score,
    airQualityScore: reading.air_quality_score,
    source: reading.source,
    fetchedAt: reading.fetched_at,
    liveConfigured: environmentService.isLiveConfigured,
  });
}

function methodology(req, res) {
  const { mode, weights } = resolveMode(req.query.mode);
  res.json({
    mode,
    weights,
    scale: '0-10 per category, blended into a 0-100 overall score',
    explanation: [
      'Weather and air quality come from a fixed monitoring source, refreshed on an interval rather than continuously polled — this signal is the same across every mode.',
      'Safety, traffic, public transport, and cleanliness are resident- and visitor-submitted, and are rated SEPARATELY per mode: a student\u2019s take on a city can genuinely differ from a family\u2019s or a professional\u2019s, so each mode blends its own running average.',
      `These weights reflect the "${mode}" mode — the same category structure, prioritized differently.`,
      'A city shows a "seed data" badge until it has at least one real submission under that specific mode.',
    ],
  });
}

module.exports = { listCities, getCity, refreshEnvironment, methodology, resolveMode };
