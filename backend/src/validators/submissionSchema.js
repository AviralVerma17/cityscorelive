'use strict';

const { z } = require('zod');

const rating = z
  .number({ invalid_type_error: 'must be a number' })
  .min(0, 'must be at least 0')
  .max(10, 'must be at most 10');

const submissionSchema = z.object({
  mode: z.enum(['student', 'professional', 'family'], {
    errorMap: () => ({ message: 'must be one of: student, professional, family' }),
  }),
  safety: rating,
  traffic: rating,
  transport: rating,
  cleanliness: rating,
  comment: z.string().trim().max(500, 'must be 500 characters or fewer').optional().nullable(),
});

const paginationSchema = z.object({
  mode: z.enum(['student', 'professional', 'family']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

module.exports = { submissionSchema, paginationSchema };
