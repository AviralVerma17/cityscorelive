'use strict';

const cityRepository = require('../models/cityRepository');
const environmentService = require('../services/environmentService');
const { computeOverallScore } = require('../services/scoringService');
const { ApiError } = require('../middleware/errorHandler');
const config = require('../config');

/**
 * Resolves a ?mode= query value to a weight profile. An unknown or
 * absent mode silently falls back to the default profile rather than
 * erroring — a bad/missing mode should never break the page, just
 * mean "no special reweighting applied."
 */
function resolveWeights(modeParam) {
  if (modeParam && config.modeWeights[modeParam]) {
    return { mode: modeParam, weights: config.modeWeights[modeParam] };
  }
  return { mode: 'default', weights: config.weights };
}

function serializeCity(row, weights) {
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
  const { weights } = resolveWeights(req.query.mode);
  const rows = cityRepository.listCities();
  res.json({ cities: rows.map((row) => serializeCity(row, weights)) });
}

function getCity(req, res) {
  const { weights } = resolveWeights(req.query.mode);
  const row = cityRepository.getCityBySlug(req.params.slug);
  if (!row) throw new ApiError(404, `No city found for slug "${req.params.slug}"`);
  res.json({ city: serializeCity(row, weights) });
}

async function refreshEnvironment(req, res) {
  const city = cityRepository.getCityBySlug(req.params.slug);
  if (!city) throw new ApiError(404, `No city found for slug "${req.params.slug}"`);

  const reading = await environmentService.refreshCity(city);
  res.json({
    slug: city.slug,
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
  const { mode, weights } = resolveWeights(req.query.mode);
  res.json({
    mode,
    weights,
    scale: '0-10 per category, blended into a 0-100 overall score',
    explanation: [
      'Weather and air quality come from a fixed monitoring source, refreshed on an interval rather than continuously polled.',
      'Safety, traffic, public transport, and cleanliness are resident- and visitor-submitted, blended into a running average per category so no single submission can swing a score.',
      mode === 'default'
        ? 'These are the default weights. Switch modes (student / professional / family) to see the same six categories reweighted for a different priority.'
        : `These weights reflect the "${mode}" mode — the same six category scores, just prioritized differently.`,
      'A city shows a "seed data" badge until it has at least one real submission.',
    ],
  });
}

module.exports = { listCities, getCity, refreshEnvironment, methodology };
