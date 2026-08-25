'use strict';

const cityRepository = require('../models/cityRepository');
const submissionRepository = require('../models/submissionRepository');
const { ApiError } = require('../middleware/errorHandler');
const hashIp = require('../utils/hashIp');
const config = require('../config');

function createSubmission(req, res) {
  const city = cityRepository.getCityBySlug(req.params.slug);
  if (!city) throw new ApiError(404, `No city found for slug "${req.params.slug}"`);

  const submitterHash = hashIp(req.ip);

  const waitMs = submissionRepository.msUntilNextAllowed(
    submitterHash,
    city.id,
    config.rateLimit.submissionWindowMs
  );
  if (waitMs > 0) {
    throw new ApiError(
      429,
      `You've already rated ${city.name} recently. Try again in about ${Math.ceil(waitMs / 60000)} minute(s).`
    );
  }

  const { safety, traffic, transport, cleanliness, comment } = req.body;
  const result = submissionRepository.createSubmission({
    cityId: city.id,
    ratings: { safety, traffic, transport, cleanliness },
    comment,
    submitterHash,
  });

  res.status(201).json({
    message: `Thanks — your rating for ${city.name} has been added to the average.`,
    updatedCategories: result,
  });
}

function listSubmissions(req, res) {
  const city = cityRepository.getCityBySlug(req.params.slug);
  if (!city) throw new ApiError(404, `No city found for slug "${req.params.slug}"`);

  const { limit, offset } = req.query;
  const { items, total } = submissionRepository.listRecentSubmissions(city.id, { limit, offset });

  res.json({
    total,
    limit,
    offset,
    submissions: items.map((s) => ({
      id: s.id,
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
