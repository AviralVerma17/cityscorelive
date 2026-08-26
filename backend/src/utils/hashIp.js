'use strict';

const crypto = require('crypto');

// Rotates per process start on purpose: we only need the hash to be
// stable *within* a rate-limit window, not forever, so we never end
// up storing anything that could be reversed into a real IP long-term.
const SALT = crypto.randomBytes(16).toString('hex');

function hashIp(ip) {
  return crypto.createHash('sha256').update(SALT).update(String(ip || 'unknown')).digest('hex');
}

module.exports = hashIp;
