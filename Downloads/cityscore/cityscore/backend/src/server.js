'use strict';

const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
require('./db/seed'); // idempotent: ensures the 20 starter cities exist
const { scheduleEnvironmentRefresh } = require('./jobs/refreshEnvironment');

const server = app.listen(config.port, () => {
  logger.info(`CityScore API listening on port ${config.port}`, { env: config.env });
  scheduleEnvironmentRefresh();
});

function shutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    logger.info('server closed');
    process.exit(0);
  });
  // Force-exit if connections don't close in time.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: reason instanceof Error ? reason.stack : reason });
});
