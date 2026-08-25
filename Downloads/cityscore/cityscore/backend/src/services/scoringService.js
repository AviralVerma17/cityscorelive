'use strict';

const config = require('../config');

/**
 * Everything in this file is pure and side-effect free on purpose:
 * it's the one place both the API (GET /methodology) and the actual
 * scoring math draw from, so the number a user sees and the
 * explanation of how it was built can never drift apart.
 */

const CROWD_CATEGORIES = ['safety', 'traffic', 'transport', 'cleanliness'];

/**
 * Converts a mean temperature (Celsius) into a 0-10 comfort score.
 * Peaks at a mild ~19-21C and falls off toward extremes. This is a
 * simple bell curve, not a claim about anyone's personal preference.
 */
function scoreFromTemp(tempC) {
  const ideal = 20;
  const spread = 14; // degrees before comfort drops sharply
  const diff = Math.abs(tempC - ideal);
  const score = 10 * Math.exp(-((diff / spread) ** 2));
  return round1(clamp(score, 0, 10));
}

/**
 * Converts a US AQI-style reading into a 0-10 score. Lower AQI is
 * better; the bands roughly track EPA AQI categories.
 */
function scoreFromAqi(aqi) {
  if (aqi <= 50) return round1(10 - (aqi / 50) * 1.5); // Good: 8.5-10
  if (aqi <= 100) return round1(8.5 - ((aqi - 50) / 50) * 2.5); // Moderate: 6-8.5
  if (aqi <= 150) return round1(6 - ((aqi - 100) / 50) * 2); // Unhealthy for sensitive groups: 4-6
  if (aqi <= 200) return round1(4 - ((aqi - 150) / 50) * 2); // Unhealthy: 2-4
  return round1(clamp(2 - ((aqi - 200) / 100) * 2, 0, 2)); // Very unhealthy+: 0-2
}

/**
 * Blends a new submission into a running average without needing to
 * replay the full submission history. `count` is the count BEFORE
 * this submission is added.
 */
function blendAverage(currentAvg, count, newValue) {
  if (count <= 0) return round1(newValue);
  return round1((currentAvg * count + newValue) / (count + 1));
}

/**
 * Computes the overall 0-100 score from the six category scores
 * (each already 0-10), using the weights in config as the single
 * source of truth for both this calculation and the /methodology
 * endpoint the frontend renders.
 */
function computeOverallScore(categoryScores) {
  const w = config.weights;
  const weighted =
    categoryScores.weather * w.weather +
    categoryScores.airQuality * w.airQuality +
    categoryScores.safety * w.safety +
    categoryScores.traffic * w.traffic +
    categoryScores.transport * w.transport +
    categoryScores.cleanliness * w.cleanliness;

  // categories are 0-10, weights sum to 1 -> weighted is 0-10, scale to 0-100
  return Math.round(clamp(weighted, 0, 10) * 10);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

module.exports = {
  CROWD_CATEGORIES,
  scoreFromTemp,
  scoreFromAqi,
  blendAverage,
  computeOverallScore,
};
