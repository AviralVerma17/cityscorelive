// Fallback dataset. Mirrors the shape the backend returns from
// GET /api/cities so the rest of the app doesn't need to know
// whether it's talking to the real API or working offline.
// This is intentionally a small subset — the full 20-city set lives
// server-side in backend/src/data/cities.json.

export const CATEGORY_META = {
  weather: { label: 'Weather', group: 'fixed', weight: 0.15 },
  airQuality: { label: 'Air quality', group: 'fixed', weight: 0.2 },
  safety: { label: 'Safety', group: 'crowd', weight: 0.2 },
  traffic: { label: 'Traffic', group: 'crowd', weight: 0.15 },
  transport: { label: 'Public transport', group: 'crowd', weight: 0.15 },
  cleanliness: { label: 'Cleanliness', group: 'crowd', weight: 0.15 },
};

export const FALLBACK_CITIES = [
  {
    slug: 'new-york-ny', name: 'New York', state: 'NY', country: 'US', lat: 40.7128, lng: -74.006,
    overallScore: 63, isSeedData: true, contributorCount: 0,
    categories: {
      weather: { score: 8.4, label: 'Weather' }, airQuality: { score: 7.1, label: 'Air quality' },
      safety: { score: 6.1, label: 'Safety' }, traffic: { score: 4.2, label: 'Traffic' },
      transport: { score: 8.6, label: 'Public transport' }, cleanliness: { score: 5.8, label: 'Cleanliness' },
    },
    environment: { tempC: 14, aqi: 52, source: 'seed', fetchedAt: null },
  },
  {
    slug: 'austin-tx', name: 'Austin', state: 'TX', country: 'US', lat: 30.2672, lng: -97.7431,
    overallScore: 66, isSeedData: true, contributorCount: 0,
    categories: {
      weather: { score: 9.6, label: 'Weather' }, airQuality: { score: 7.5, label: 'Air quality' },
      safety: { score: 6.9, label: 'Safety' }, traffic: { score: 4.1, label: 'Traffic' },
      transport: { score: 5.5, label: 'Public transport' }, cleanliness: { score: 6.8, label: 'Cleanliness' },
    },
    environment: { tempC: 21, aqi: 46, source: 'seed', fetchedAt: null },
  },
  {
    slug: 'durgapur-wb', name: 'Durgapur', state: 'WB', country: 'IN', lat: 23.5204, lng: 87.3119,
    overallScore: 55, isSeedData: true, contributorCount: 0,
    categories: {
      weather: { score: 8.0, label: 'Weather' }, airQuality: { score: 3.5, label: 'Air quality' },
      safety: { score: 6.6, label: 'Safety' }, traffic: { score: 5.8, label: 'Traffic' },
      transport: { score: 5.0, label: 'Public transport' }, cleanliness: { score: 5.7, label: 'Cleanliness' },
    },
    environment: { tempC: 26, aqi: 88, source: 'seed', fetchedAt: null },
  },
];

export const FALLBACK_METHODOLOGY = {
  weights: Object.fromEntries(Object.entries(CATEGORY_META).map(([k, v]) => [k, v.weight])),
  scale: '0-10 per category, blended into a 0-100 overall score',
  explanation: [
    'Weather and air quality (35% combined) come from a fixed monitoring source, refreshed on an interval rather than continuously polled.',
    'Safety, traffic, public transport, and cleanliness (65% combined) are resident- and visitor-submitted, blended into a running average per category so no single submission can swing a score.',
    'A city shows a "seed data" badge until it has at least one real submission.',
  ],
};
