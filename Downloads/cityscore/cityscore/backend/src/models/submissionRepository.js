'use strict';

const db = require('../db');
const { blendAverage } = require('../services/scoringService');

const getScores = db.prepare('SELECT * FROM category_scores WHERE city_id = ?');
const updateScores = db.prepare(`
  UPDATE category_scores SET
    safety_avg = @safety, traffic_avg = @traffic, transport_avg = @transport, cleanliness_avg = @cleanliness,
    submission_count = @count, updated_at = datetime('now')
  WHERE city_id = @cityId
`);
const insertSubmission = db.prepare(`
  INSERT INTO submissions (city_id, safety, traffic, transport, cleanliness, comment, submitter_hash)
  VALUES (@cityId, @safety, @traffic, @transport, @cleanliness, @comment, @submitterHash)
`);
const getThrottle = db.prepare(
  'SELECT last_submitted_at FROM submission_throttle WHERE submitter_hash = ? AND city_id = ?'
);
const upsertThrottle = db.prepare(`
  INSERT INTO submission_throttle (submitter_hash, city_id, last_submitted_at)
  VALUES (@submitterHash, @cityId, datetime('now'))
  ON CONFLICT(submitter_hash, city_id) DO UPDATE SET last_submitted_at = datetime('now')
`);
const listRecentStmt = db.prepare(`
  SELECT id, safety, traffic, transport, cleanliness, comment, created_at
  FROM submissions
  WHERE city_id = ?
  ORDER BY created_at DESC
  LIMIT ? OFFSET ?
`);
const countStmt = db.prepare('SELECT COUNT(*) AS total FROM submissions WHERE city_id = ?');

/**
 * Returns milliseconds until this submitter may submit again for this
 * city, or 0 if they're clear. Enforced at the application layer as a
 * second, category-aware layer on top of the generic express-rate-limit
 * window, so a single contributor can't quietly dominate one city's
 * average even if they vary their request timing.
 */
function msUntilNextAllowed(submitterHash, cityId, windowMs) {
  const row = getThrottle.get(submitterHash, cityId);
  if (!row) return 0;
  const last = new Date(row.last_submitted_at + 'Z').getTime();
  const elapsed = Date.now() - last;
  return elapsed >= windowMs ? 0 : windowMs - elapsed;
}

const submitTransaction = db.transaction((cityId, ratings, comment, submitterHash) => {
  const current = getScores.get(cityId);
  const count = current.submission_count;

  const blended = {
    safety: blendAverage(current.safety_avg, count, ratings.safety),
    traffic: blendAverage(current.traffic_avg, count, ratings.traffic),
    transport: blendAverage(current.transport_avg, count, ratings.transport),
    cleanliness: blendAverage(current.cleanliness_avg, count, ratings.cleanliness),
  };

  updateScores.run({ cityId, ...blended, count: count + 1 });
  insertSubmission.run({ cityId, ...ratings, comment: comment || null, submitterHash });
  upsertThrottle.run({ submitterHash, cityId });

  return { ...blended, submissionCount: count + 1 };
});

function createSubmission({ cityId, ratings, comment, submitterHash }) {
  return submitTransaction(cityId, ratings, comment, submitterHash);
}

function listRecentSubmissions(cityId, { limit = 20, offset = 0 } = {}) {
  return {
    items: listRecentStmt.all(cityId, limit, offset),
    total: countStmt.get(cityId).total,
  };
}

module.exports = { createSubmission, listRecentSubmissions, msUntilNextAllowed };
