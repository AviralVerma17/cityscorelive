'use strict';

const cityRepository = require('../models/cityRepository');
const environmentService = require('../services/environmentService');
const { computeOverallScore } = require('../services/scoringService');
const { ApiError } = require('../middleware/errorHandler');
const config = require('../config');

function serializeCity(row) {
  const categories = {
    weather: { score: row.weather_score ?? 0, label: 'Weather' },
    airQuality: { score: row.air_quality_score ?? 0, label: 'Air quality' },
    safety: { score: row.safety_avg ?? 0, label: 'Safety' },
    traffic: { score: row.traffic_avg ?? 0, label: 'Traffic' },
    transport: { score: row.transport_avg ?? 0, label: 'Public transport' },
    cleanliness: { score: row.cleanliness_avg ?? 0, label: 'Cleanliness' },
  };

  const overall = computeOverallScore({
    weather: categories.weather.score,
    airQuality: categories.airQuality.score,
    safety: categories.safety.score,
    traffic: categories.traffic.score,
    transport: categories.transport.score,
    cleanliness: categories.cleanliness.score,
  });

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
  const rows = cityRepository.listCities();
  res.json({ cities: rows.map(serializeCity) });
}

function getCity(req, res) {
  const row = cityRepository.getCityBySlug(req.params.slug);
  if (!row) throw new ApiError(404, `No city found for slug "${req.params.slug}"`);
  res.json({ city: serializeCity(row) });
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
  res.json({
    weights: config.weights,
    scale: '0-10 per category, blended into a 0-100 overall score',
    explanation: [
      'Weather and air quality (35% combined) come from a fixed monitoring source, refreshed on an interval rather than continuously polled.',
      'Safety, traffic, public transport, and cleanliness (65% combined) are resident- and visitor-submitted, blended into a running average per category so no single submission can swing a score.',
      'A city shows a "seed data" badge until it has at least one real submission.',
    ],
  });
}

module.exports = { listCities, getCity, refreshEnvironment, methodology };
