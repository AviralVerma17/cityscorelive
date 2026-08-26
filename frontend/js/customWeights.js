// "Best for me": lets a person set their own relative priorities
// across all six categories (not one of the three fixed modes) and
// ranks the currently-loaded cities against those weights instead of
// the mode's own overall score. Pure client-side — it just re-weighs
// the category scores already loaded for the active mode, using the
// same scoring formula the backend uses (see modes.js).

import { computeOverallScoreLocal } from './modes.js';

export const CUSTOM_CATEGORY_KEYS = ['weather', 'airQuality', 'safety', 'traffic', 'transport', 'cleanliness'];

/**
 * Turns raw 0-10 slider values (how much each category matters to
 * the person) into weights that sum to 1, so people don't have to do
 * the math themselves to make their priorities add up to 100%.
 */
export function normalizeSliderValues(raw) {
  const total = CUSTOM_CATEGORY_KEYS.reduce((sum, key) => sum + (Number(raw[key]) || 0), 0);
  if (total <= 0) {
    const equal = 1 / CUSTOM_CATEGORY_KEYS.length;
    return Object.fromEntries(CUSTOM_CATEGORY_KEYS.map((key) => [key, equal]));
  }
  return Object.fromEntries(CUSTOM_CATEGORY_KEYS.map((key) => [key, (Number(raw[key]) || 0) / total]));
}

/**
 * Ranks the given cities by a custom weight profile, attaching a
 * `customScore` to each (leaving the city's own `overallScore`
 * untouched) and sorting descending.
 */
export function rankCitiesByCustomWeights(cities, weights) {
  return cities
    .map((city) => ({
      ...city,
      customScore: computeOverallScoreLocal(
        {
          weather: city.categories.weather.score,
          airQuality: city.categories.airQuality.score,
          safety: city.categories.safety.score,
          traffic: city.categories.traffic.score,
          transport: city.categories.transport.score,
          cleanliness: city.categories.cleanliness.score,
        },
        weights
      ),
    }))
    .sort((a, b) => b.customScore - a.customScore);
}
