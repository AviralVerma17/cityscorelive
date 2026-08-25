'use strict';

const db = require('../db');

const listStmt = db.prepare(`
  SELECT c.id, c.slug, c.name, c.state, c.country, c.lat, c.lng, c.population,
         s.safety_avg, s.traffic_avg, s.transport_avg, s.cleanliness_avg, s.submission_count,
         e.temp_c, e.weather_score, e.aqi, e.air_quality_score, e.source AS environment_source, e.fetched_at
  FROM cities c
  LEFT JOIN category_scores s ON s.city_id = c.id
  LEFT JOIN environment_readings e ON e.city_id = c.id
  ORDER BY c.name ASC
`);

const getBySlugStmt = db.prepare(`
  SELECT c.id, c.slug, c.name, c.state, c.country, c.lat, c.lng, c.population,
         s.safety_avg, s.traffic_avg, s.transport_avg, s.cleanliness_avg, s.submission_count,
         e.temp_c, e.weather_score, e.aqi, e.air_quality_score, e.source AS environment_source, e.fetched_at
  FROM cities c
  LEFT JOIN category_scores s ON s.city_id = c.id
  LEFT JOIN environment_readings e ON e.city_id = c.id
  WHERE c.slug = ?
`);

const getByIdStmt = db.prepare('SELECT * FROM cities WHERE id = ?');

function listCities() {
  return listStmt.all();
}

function getCityBySlug(slug) {
  return getBySlugStmt.get(slug);
}

function getCityById(id) {
  return getByIdStmt.get(id);
}

module.exports = { listCities, getCityBySlug, getCityById };
