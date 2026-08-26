'use strict';

const { Router } = require('express');
const citiesRouter = require('./cities');

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

router.use('/', citiesRouter);

module.exports = router;
