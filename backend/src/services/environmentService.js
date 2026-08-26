'use strict';

const config = require('../config');
const db = require('../db');
const logger = require('../utils/logger');
const { seededRandom } = require('../utils/slugify');
const { scoreFromTemp, scoreFromAqi } = require('./scoringService');

const upsertReading = db.prepare(`
  INSERT INTO environment_readings (city_id, temp_c, weather_score, aqi, air_quality_score, source, fetched_at)
  VALUES (@cityId, @temp, @weatherScore, @aqi, @airScore, @source, datetime('now'))
  ON CONFLICT(city_id) DO UPDATE SET
    temp_c = excluded.temp_c,
    weather_score = excluded.weather_score,
    aqi = excluded.aqi,
    air_quality_score = excluded.air_quality_score,
    source = excluded.source,
    fetched_at = excluded.fetched_at
`);

const getReading = db.prepare('SELECT * FROM environment_readings WHERE city_id = ?');

const isLiveConfigured = Boolean(config.environment.openWeatherApiKey && config.environment.aqicnApiKey);

/**
 * Real fetch path. Only used when both API keys are present. Kept
 * isolated behind this one function so swapping providers later
 * means editing this function, nothing else.
 */
async function fetchLive(city) {
  const [weatherRes, aqiRes] = await Promise.all([
    fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lng}&units=metric&appid=${config.environment.openWeatherApiKey}`
    ),
    fetch(`https://api.waqi.info/feed/geo:${city.lat};${city.lng}/?token=${config.environment.aqicnApiKey}`),
  ]);

  if (!weatherRes.ok) throw new Error(`OpenWeather request failed: ${weatherRes.status}`);
  if (!aqiRes.ok) throw new Error(`AQICN request failed: ${aqiRes.status}`);

  const weatherJson = await weatherRes.json();
  const aqiJson = await aqiRes.json();

  const temp = weatherJson?.main?.temp;
  const aqi = aqiJson?.data?.aqi;

  if (typeof temp !== 'number' || typeof aqi !== 'number') {
    throw new Error('Unexpected shape from upstream weather/AQI API');
  }

  return { temp, aqi, source: 'live' };
}

/**
 * Seed path: deterministic, slowly-drifting values derived from the
 * city's baseline plus a seeded random walk keyed to the current
 * hour. This is what runs when no API keys are configured (e.g. this
 * project's own dev sandbox), and it's clearly labeled `source: "seed"`
 * end to end so the UI never claims to be live when it isn't.
 */
function generateSeed(city) {
  const hourBucket = Math.floor(Date.now() / (1000 * 60 * 60));
  const rand = seededRandom(`${city.slug}:${hourBucket}`);

  const tempJitter = (rand() - 0.5) * 4; // +/-2C
  const aqiJitter = (rand() - 0.5) * 16; // +/-8 AQI points

  const temp = city.envBaseline.temp + tempJitter;
  const aqi = Math.max(5, city.envBaseline.aqi + aqiJitter);

  return { temp, aqi, source: 'seed' };
}

async function refreshCity(city) {
  let reading;
  if (isLiveConfigured) {
    try {
      reading = await fetchLive(city);
    } catch (err) {
      logger.warn('live environment fetch failed, falling back to seed', { city: city.slug, error: err.message });
      reading = generateSeed(city);
    }
  } else {
    reading = generateSeed(city);
  }

  upsertReading.run({
    cityId: city.id,
    temp: reading.temp,
    weatherScore: scoreFromTemp(reading.temp),
    aqi: reading.aqi,
    airScore: scoreFromAqi(reading.aqi),
    source: reading.source,
  });

  return getReading.get(city.id);
}

function getCachedReading(cityId) {
  return getReading.get(cityId);
}

module.exports = {
  isLiveConfigured,
  refreshCity,
  getCachedReading,
};
