// Talks to a locally-run backend by default. Override by setting
// window.CITYSCORE_API_BASE before this script runs (e.g. in a
// hosted deployment), or the app falls back to local seed data when
// no backend answers at all — see api.js.
export const API_BASE = window.CITYSCORE_API_BASE || 'http://localhost:4000/api';
