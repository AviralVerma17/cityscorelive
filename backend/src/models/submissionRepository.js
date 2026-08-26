'use strict';

const db = require('../db');
const { blendAverage } = require('../services/scoringService');

const getScores = db.prepare('SELECT * FROM mode_category_scores WHERE city_id = @cityId AND mode = @mode');
const updateScores = db.prepare(`
  UPDATE mode_category_scores SET
    safety_avg = @safety, traffic_avg = @traffic, transport_avg = @transport, cleanliness_avg = @cleanliness,
    submission_count = @count, updated_at = datetime('now')
  WHERE city_id = @cityId AND mode = @mode
`);
const insertSubmission = db.prepare(`
  INSERT INTO submissions (city_id, mode, safety, traffic, transport, cleanliness, comment, submitter_hash)
  VALUES (@cityId, @mode, @safety, @traffic, @transport, @cleanliness, @comment, @submitterHash)
`);
const getThrottle = db.prepare(
  'SELECT last_submitted_at FROM submission_throttle WHERE submitter_hash = @submitterHash AND city_id = @cityId AND mode = @mode'
);
const upsertThrottle = db.prepare(`
  INSERT INTO submission_throttle (submitter_hash, city_id, mode, last_submitted_at)
  VALUES (@submitterHash, @cityId, @mode, datetime('now'))
  ON CONFLICT(submitter_hash, city_id, mode) DO UPDATE SET last_submitted_at = datetime('now')
`);
const listRecentStmt = db.prepare(`
  SELECT id, mode, safety, traffic, transport, cleanliness, comment, created_at
  FROM submissions
  WHERE city_id = @cityId AND mode = @mode
  ORDER BY created_at DESC
  LIMIT @limit OFFSET @offset
`);
const countStmt = db.prepare('SELECT COUNT(*) AS total FROM submissions WHERE city_id = @cityId AND mode = @mode');

/**
 * Returns milliseconds until this submitter may submit again for this
 * city UNDER THIS SPECIFIC MODE, or 0 if they're clear. Rating the
 * same city under a different mode is a separate, independent
 * submission and isn't affected by this check.
 */
function msUntilNextAllowed(submitterHash, cityId, mode, windowMs) {
  const row = getThrottle.get({ submitterHash, cityId, mode });
  if (!row) return 0;
  const last = new Date(row.last_submitted_at + 'Z').getTime();
  const elapsed = Date.now() - last;
  return elapsed >= windowMs ? 0 : windowMs - elapsed;
}

const submitTransaction = db.transaction((cityId, mode, ratings, comment, submitterHash) => {
  const current = getScores.get({ cityId, mode });
  const count = current.submission_count;

  const blended = {
    safety: blendAverage(current.safety_avg, count, ratings.safety),
    traffic: blendAverage(current.traffic_avg, count, ratings.traffic),
    transport: blendAverage(current.transport_avg, count, ratings.transport),
    cleanliness: blendAverage(current.cleanliness_avg, count, ratings.cleanliness),
  };

  updateScores.run({ cityId, mode, ...blended, count: count + 1 });
  insertSubmission.run({ cityId, mode, ...ratings, comment: comment || null, submitterHash });
  upsertThrottle.run({ submitterHash, cityId, mode });

  return { ...blended, submissionCount: count + 1 };
});

function createSubmission({ cityId, mode, ratings, comment, submitterHash }) {
  return submitTransaction(cityId, mode, ratings, comment, submitterHash);
}

function listRecentSubmissions(cityId, mode, { limit = 20, offset = 0 } = {}) {
  return {
    items: listRecentStmt.all({ cityId, mode, limit, offset }),
    total: countStmt.get({ cityId, mode }).total,
  };
}

module.exports = { createSubmission, listRecentSubmissions, msUntilNextAllowed };
