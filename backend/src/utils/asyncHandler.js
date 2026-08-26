'use strict';

/**
 * Wraps an async route/controller so a thrown error or rejected promise
 * is forwarded to Express's error-handling middleware instead of
 * crashing the process or hanging the request.
 */
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
