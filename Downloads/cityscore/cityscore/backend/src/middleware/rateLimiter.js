'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests. Please slow down and try again shortly.' } },
});

// A tighter limiter specifically on the write path, on top of the
// per-city/per-submitter throttle enforced in submissionRepository.
const submissionLimiter = rateLimit({
  windowMs: config.rateLimit.submissionWindowMs,
  max: config.rateLimit.submissionMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many submissions from this address. Try again later.' } },
});

module.exports = { apiLimiter, submissionLimiter };
