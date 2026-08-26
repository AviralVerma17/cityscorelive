'use strict';

const config = require('../config');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[config.logLevel] ?? LEVELS.info;

function timestamp() {
  return new Date().toISOString();
}

function log(level, message, meta) {
  if (LEVELS[level] > currentLevel) return;
  const line = {
    time: timestamp(),
    level,
    message,
    ...(meta ? { meta } : {}),
  };
  const serialized = JSON.stringify(line);
  if (level === 'error') {
    console.error(serialized);
  } else {
    console.log(serialized);
  }
}

module.exports = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
};
