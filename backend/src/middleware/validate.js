'use strict';

const { ApiError } = require('./errorHandler');

/**
 * Returns middleware that validates req[part] against a zod schema,
 * replacing it with the parsed (and coerced) result on success, or
 * forwarding a 400 with field-level detail on failure.
 */
function validate(schema, part = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new ApiError(400, 'Validation failed', details));
    }
    req[part] = result.data;
    next();
  };
}

module.exports = validate;
