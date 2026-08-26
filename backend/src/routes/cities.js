'use strict';

const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middleware/validate');
const { submissionLimiter } = require('../middleware/rateLimiter');
const citiesController = require('../controllers/citiesController');
const submissionsController = require('../controllers/submissionsController');
const { submissionSchema, paginationSchema } = require('../validators/submissionSchema');

const router = Router();

router.get('/cities', asyncHandler(citiesController.listCities));
router.get('/cities/:slug', asyncHandler(citiesController.getCity));
router.post('/cities/:slug/environment/refresh', asyncHandler(citiesController.refreshEnvironment));

router.get(
  '/cities/:slug/submissions',
  validate(paginationSchema, 'query'),
  asyncHandler(submissionsController.listSubmissions)
);
router.post(
  '/cities/:slug/submissions',
  submissionLimiter,
  validate(submissionSchema, 'body'),
  asyncHandler(submissionsController.createSubmission)
);

router.get('/methodology', citiesController.methodology);

module.exports = router;
