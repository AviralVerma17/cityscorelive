'use strict';

const db = require('../db');

// All queries take `mode` explicitly — there's no mode-agnostic view
// of a city's crowd-submitted categories anymore, since those are
// rated per mode. Callers always resolve a concrete mode first (see
// citiesController.resolveWeights) before reaching this layer.

const listStmt = db.prepare(`
  SELECT c.id, c.slug, c.name, c.state, c.country, c.lat, c.lng, c.population,
         s.safety_avg, s.traffic_avg, s.transport_avg, s.cleanliness_avg, s.submission_count,
         e.temp_c, e.weather_score, e.aqi, e.air_quality_score, e.source AS environment_source, e.fetched_at
  FROM cities c
  LEFT JOIN mode_category_scores s ON s.city_id = c.id AND s.mode = @mode
  LEFT JOIN environment_readings e ON e.city_id = c.id
  ORDER BY c.name ASC
`);

const getBySlugStmt = db.prepare(`
  SELECT c.id, c.slug, c.name, c.state, c.country, c.lat, c.lng, c.population,
         s.safety_avg, s.traffic_avg, s.transport_avg, s.cleanliness_avg, s.submission_count,
         e.temp_c, e.weather_score, e.aqi, e.air_quality_score, e.source AS environment_source, e.fetched_at
  FROM cities c
  LEFT JOIN mode_category_scores s ON s.city_id = c.id AND s.mode = @mode
  LEFT JOIN environment_readings e ON e.city_id = c.id
  WHERE c.slug = @slug
`);

const getByIdStmt = db.prepare('SELECT * FROM cities WHERE id = ?');

function listCities(mode) {
  return listStmt.all({ mode });
}

function getCityBySlug(slug, mode) {
  return getBySlugStmt.get({ slug, mode });
}

function getCityById(id) {
  return getByIdStmt.get(id);
}

module.exports = { listCities, getCityBySlug, getCityById };
