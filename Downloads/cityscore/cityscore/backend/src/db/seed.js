'use strict';

/**
 * Idempotent seed: safe to run every deploy. Inserts each city once
 * (on slug conflict, does nothing) and, for a brand-new city, seeds
 * its category_scores row from the baseline in data/cities.json so
 * the UI has a believable starting point before any real submissions
 * arrive. A city's `submission_count` starts at 0 either way — the
 * frontend uses that to show the "seed data" badge honestly.
 */
const db = require('./index');
const cities = require('../data/cities.json');
const logger = require('../utils/logger');

const insertCity = db.prepare(`
  INSERT INTO cities (slug, name, state, country, lat, lng, population)
  VALUES (@slug, @name, @state, @country, @lat, @lng, @population)
  ON CONFLICT(slug) DO NOTHING
`);

const insertScores = db.prepare(`
  INSERT INTO category_scores (city_id, safety_avg, traffic_avg, transport_avg, cleanliness_avg, submission_count, updated_at)
  VALUES (@cityId, @safety, @traffic, @transport, @cleanliness, 0, NULL)
  ON CONFLICT(city_id) DO NOTHING
`);

const insertEnvironment = db.prepare(`
  INSERT INTO environment_readings (city_id, temp_c, weather_score, aqi, air_quality_score, source, fetched_at)
  VALUES (@cityId, @temp, @weatherScore, @aqi, @airScore, 'seed', datetime('now'))
  ON CONFLICT(city_id) DO NOTHING
`);

const getIdBySlug = db.prepare('SELECT id FROM cities WHERE slug = ?');

const { scoreFromTemp, scoreFromAqi } = require('../services/scoringService');

const run = db.transaction((rows) => {
  for (const city of rows) {
    insertCity.run({
      slug: city.slug,
      name: city.name,
      state: city.state,
      country: city.country,
      lat: city.lat,
      lng: city.lng,
      population: city.population,
    });
    const row = getIdBySlug.get(city.slug);
    const cityId = row.id;

    insertScores.run({
      cityId,
      safety: city.baseline.safety,
      traffic: city.baseline.traffic,
      transport: city.baseline.transport,
      cleanliness: city.baseline.cleanliness,
    });

    insertEnvironment.run({
      cityId,
      temp: city.envBaseline.temp,
      weatherScore: scoreFromTemp(city.envBaseline.temp),
      aqi: city.envBaseline.aqi,
      airScore: scoreFromAqi(city.envBaseline.aqi),
    });
  }
});

run(cities);
logger.info(`seed complete: ${cities.length} cities ensured`);

if (require.main === module) {
  process.exit(0);
}
