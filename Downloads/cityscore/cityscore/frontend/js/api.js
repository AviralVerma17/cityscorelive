import { API_BASE } from './config.js';
import { FALLBACK_CITIES, FALLBACK_METHODOLOGY } from './data.js';

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

export async function getCities() {
  try {
    const body = await tryFetch('/cities');
    backendReachable = true;
    return { cities: body.cities, offline: false };
  } catch (err) {
    backendReachable = false;
    console.warn('CityScore backend unreachable, using local seed data:', err.message);
    return { cities: FALLBACK_CITIES, offline: true };
  }
}

export async function getMethodology() {
  try {
    return await tryFetch('/methodology');
  } catch {
    return FALLBACK_METHODOLOGY;
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
