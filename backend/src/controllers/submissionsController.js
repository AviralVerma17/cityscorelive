'use strict';

const cityRepository = require('../models/cityRepository');
const submissionRepository = require('../models/submissionRepository');
const { ApiError } = require('../middleware/errorHandler');
const hashIp = require('../utils/hashIp');
const config = require('../config');

function createSubmission(req, res) {
  const { mode, safety, traffic, transport, cleanliness, comment } = req.body;

  // Look up the city scoped to the mode being rated — a 404 here just
  // means the slug doesn't exist, not that this mode lacks data (every
  // seeded city has a row for all three modes).
  const city = cityRepository.getCityBySlug(req.params.slug, mode);
  if (!city) throw new ApiError(404, `No city found for slug "${req.params.slug}"`);

  const submitterHash = hashIp(req.ip);

  const waitMs = submissionRepository.msUntilNextAllowed(
    submitterHash,
    city.id,
    mode,
    config.rateLimit.submissionWindowMs
  );
  if (waitMs > 0) {
    throw new ApiError(
      429,
      `You've already rated ${city.name} for ${mode} mode recently. Try again in about ${Math.ceil(waitMs / 60000)} minute(s), or rate it under a different mode.`
    );
  }

  const result = submissionRepository.createSubmission({
    cityId: city.id,
    mode,
    ratings: { safety, traffic, transport, cleanliness },
    comment,
    submitterHash,
  });

  res.status(201).json({
    message: `Thanks — your ${mode}-mode rating for ${city.name} has been added to the average.`,
    mode,
    updatedCategories: result,
  });
}

function listSubmissions(req, res) {
  const mode = req.query.mode || config.defaultMode;
  const city = cityRepository.getCityBySlug(req.params.slug, mode);
  if (!city) throw new ApiError(404, `No city found for slug "${req.params.slug}"`);

  const { limit, offset } = req.query;
  const { items, total } = submissionRepository.listRecentSubmissions(city.id, mode, { limit, offset });

  res.json({
    mode,
    total,
    limit,
    offset,
    submissions: items.map((s) => ({
      id: s.id,
      mode: s.mode,
      safety: s.safety,
      traffic: s.traffic,
      transport: s.transport,
      cleanliness: s.cleanliness,
      comment: s.comment,
      createdAt: s.created_at,
    })),
  });
}

module.exports = { createSubmission, listSubmissions };
