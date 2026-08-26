'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

const app = express();

// Behind a reverse proxy (nginx/Render/Fly/etc.) in production so
// req.ip reflects the real client instead of the proxy hop.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: config.cors.allowedOrigins,
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(
  morgan(config.env === 'production' ? 'combined' : 'dev', {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);
app.use('/api', apiLimiter);

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
