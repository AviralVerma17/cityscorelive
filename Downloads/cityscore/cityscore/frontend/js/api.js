import { API_BASE } from './config.js';
import { FALLBACK_CITIES, FALLBACK_METHODOLOGY } from './data.js';
import { MODES, DEFAULT_MODE, computeOverallScoreLocal } from './modes.js';

let backendReachable = null; // null = unknown, true/false once tested

async function tryFetch(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.details = body?.error?.details;
    throw err;
  }
  return body;
}

/**
 * Recomputes each fallback city's overallScore for the requested mode
 * using the exact same formula the backend uses, so switching modes
 * still works meaningfully while offline — just against the small
 * local dataset instead of the full 20 cities.
 */
function applyModeToFallback(cities, mode) {
  const weights = MODES[mode]?.weights || MODES[DEFAULT_MODE].weights;
  return cities.map((city) => ({
    ...city,
    overallScore: computeOverallScoreLocal(
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
  }));
}

export async function getCities(mode = DEFAULT_MODE) {
  try {
    const body = await tryFetch(`/cities?mode=${encodeURIComponent(mode)}`);
    backendReachable = true;
    return { cities: body.cities, offline: false };
  } catch (err) {
    backendReachable = false;
    console.warn('CityScore backend unreachable, using local seed data:', err.message);
    return { cities: applyModeToFallback(FALLBACK_CITIES, mode), offline: true };
  }
}

export async function getMethodology(mode = DEFAULT_MODE) {
  try {
    return await tryFetch(`/methodology?mode=${encodeURIComponent(mode)}`);
  } catch {
    return { ...FALLBACK_METHODOLOGY, mode, weights: MODES[mode]?.weights || MODES[DEFAULT_MODE].weights };
  }
}

export async function submitRating(slug, ratings) {
  if (backendReachable === false) {
    throw new Error('The live backend is unreachable right now, so ratings can\u2019t be saved. Start the API and refresh.');
  }
  return tryFetch(`/cities/${slug}/submissions`, {
    method: 'POST',
    body: JSON.stringify(ratings),
  });
}

export function isOffline() {
  return backendReachable === false;
}
