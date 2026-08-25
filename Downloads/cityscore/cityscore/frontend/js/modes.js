// Mirrors backend/src/config.js's `modeWeights` — kept in sync by
// hand since there are only three fixed profiles. The backend is
// still the source of truth for any live request (GET /cities?mode=X
// is scored server-side); this copy exists only so the offline
// fallback view (api.js, when the backend is unreachable) can
// recompute scores locally using the same weights and formula.

export const MODES = {
  family: {
    label: 'Family',
    description: 'Prioritizes safety and air quality for raising kids.',
    weights: { weather: 0.10, airQuality: 0.25, safety: 0.30, traffic: 0.10, transport: 0.10, cleanliness: 0.15 },
  },
  professional: {
    label: 'Professional',
    description: 'Prioritizes traffic and public transport for an easy commute.',
    weights: { weather: 0.10, airQuality: 0.10, safety: 0.15, traffic: 0.25, transport: 0.30, cleanliness: 0.10 },
  },
  student: {
    label: 'Student',
    description: 'Prioritizes public transport, safety, and cleanliness.',
    weights: { weather: 0.10, airQuality: 0.15, safety: 0.20, traffic: 0.10, transport: 0.25, cleanliness: 0.20 },
  },
};

export const DEFAULT_MODE = 'family';

/**
 * Same formula as backend/src/services/scoringService.js's
 * computeOverallScore — kept identical so the offline fallback view
 * never disagrees with what the real API would return.
 */
export function computeOverallScoreLocal(categories, weights) {
  const weighted =
    categories.weather * weights.weather +
    categories.airQuality * weights.airQuality +
    categories.safety * weights.safety +
    categories.traffic * weights.traffic +
    categories.transport * weights.transport +
    categories.cleanliness * weights.cleanliness;

  const clamped = Math.min(10, Math.max(0, weighted));
  return Math.round(clamped * 10);
}
