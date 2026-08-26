'use strict';

const cron = require('node-cron');
const config = require('../config');
const cityRepository = require('../models/cityRepository');
const environmentService = require('../services/environmentService');
const logger = require('../utils/logger');

/**
 * Refreshes weather/AQI for every city sequentially (not in parallel)
 * to stay polite to upstream rate limits when live keys are set. In
 * seed mode this is cheap regardless since no network call happens.
 */
async function refreshAll() {
  const cities = cityRepository.listCities();
  logger.info('environment refresh starting', { cities: cities.length, live: environmentService.isLiveConfigured });

  for (const city of cities) {
    try {
      await environmentService.refreshCity(city);
    } catch (err) {
      logger.error('environment refresh failed for city', { city: city.slug, error: err.message });
    }
  }
  logger.info('environment refresh complete');
}

function scheduleEnvironmentRefresh() {
  const minutes = config.environment.refreshIntervalMinutes;
  const cronExpression = `*/${minutes} * * * *`;

  // Run once at boot so data isn't stale-looking immediately after a
  // fresh deploy, then on the configured interval after that.
  refreshAll().catch((err) => logger.error('initial environment refresh failed', { error: err.message }));

  cron.schedule(cronExpression, () => {
    refreshAll().catch((err) => logger.error('scheduled environment refresh failed', { error: err.message }));
  });

  logger.info('environment refresh scheduled', { cronExpression });
}

module.exports = { scheduleEnvironmentRefresh, refreshAll };
