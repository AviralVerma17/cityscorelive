'use strict';

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite'); // built into Node 22.5+/24 — no native build step
const config = require('../config');
const logger = require('../utils/logger');

const dbFile = path.resolve(process.cwd(), config.db.file);
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new DatabaseSync(dbFile);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

/**
 * node:sqlite has no built-in transaction() helper the way
 * better-sqlite3 does, so this polyfills the same shape: db.transaction(fn)
 * returns a function that runs `fn` inside BEGIN/COMMIT, rolling back
 * and rethrowing on error. Everything elsewhere in the codebase
 * (seed.js, submissionRepository.js) calls db.transaction(...) exactly
 * as it would against better-sqlite3.
 */
db.transaction = function transaction(fn) {
  return function runInTransaction(...args) {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
};

logger.info('database ready', { file: dbFile });

module.exports = db;
