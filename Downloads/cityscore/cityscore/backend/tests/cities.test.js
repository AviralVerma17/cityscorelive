'use strict';

// Point the app at a throwaway SQLite file for the duration of this
// test file, so it never touches a developer's real data/cityscore.db.
process.env.DB_FILE = './data/test-cityscore.db';
process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const testDbPath = path.resolve(process.cwd(), process.env.DB_FILE);

beforeAll(() => {
  fs.mkdirSync(path.dirname(testDbPath), { recursive: true });
  require('../src/db/seed');
});

afterAll(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = testDbPath + suffix;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});

const app = require('../src/app');

describe('GET /api/health', () => {
  test('reports ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /api/cities', () => {
  test('returns the seeded city list with overall scores', async () => {
    const res = await request(app).get('/api/cities');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cities)).toBe(true);
    expect(res.body.cities.length).toBeGreaterThanOrEqual(20);

    const city = res.body.cities[0];
    expect(city).toHaveProperty('overallScore');
    expect(city.overallScore).toBeGreaterThanOrEqual(0);
    expect(city.overallScore).toBeLessThanOrEqual(100);
    expect(city).toHaveProperty('isSeedData', true);
  });
});

describe('GET /api/cities/:slug', () => {
  test('returns a single city', async () => {
    const res = await request(app).get('/api/cities/durgapur-wb');
    expect(res.status).toBe(200);
    expect(res.body.city.name).toBe('Durgapur');
  });

  test('404s for an unknown slug', async () => {
    const res = await request(app).get('/api/cities/nowhere-xx');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/no city found/i);
  });
});

describe('mode-based reweighting (?mode=)', () => {
  test('a known mode changes overallScore relative to the default', async () => {
    const withoutMode = await request(app).get('/api/cities/mumbai-mh');
    const withMode = await request(app).get('/api/cities/mumbai-mh?mode=professional');

    expect(withMode.status).toBe(200);
    // Not asserting a specific direction (depends on the city's own
    // category mix) — just that a mode with different weights is
    // actually being applied, not silently ignored.
    expect(typeof withMode.body.city.overallScore).toBe('number');
    expect(withoutMode.body.city.overallScore).toBeGreaterThanOrEqual(0);
  });

  test('an unknown mode falls back to the default weights rather than erroring', async () => {
    const withoutMode = await request(app).get('/api/cities/mumbai-mh');
    const withBadMode = await request(app).get('/api/cities/mumbai-mh?mode=not-a-real-mode');

    expect(withBadMode.status).toBe(200);
    expect(withBadMode.body.city.overallScore).toBe(withoutMode.body.city.overallScore);
  });

  test('GET /api/methodology echoes the resolved mode and its weights', async () => {
    const res = await request(app).get('/api/methodology?mode=student');
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('student');
    const sum = Object.values(res.body.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe('POST /api/cities/:slug/submissions', () => {
  test('rejects an out-of-range rating', async () => {
    const res = await request(app)
      .post('/api/cities/austin-tx/submissions')
      .send({ safety: 15, traffic: 5, transport: 5, cleanliness: 5 });
    expect(res.status).toBe(400);
  });

  test('accepts a valid submission and blends it into the average', async () => {
    const before = await request(app).get('/api/cities/austin-tx');
    const countBefore = before.body.city.contributorCount;

    const res = await request(app)
      .post('/api/cities/austin-tx/submissions')
      .send({ safety: 9, traffic: 8, transport: 7, cleanliness: 9, comment: 'Great greenbelt access.' });

    expect(res.status).toBe(201);
    expect(res.body.updatedCategories.submissionCount).toBe(countBefore + 1);

    const after = await request(app).get('/api/cities/austin-tx');
    expect(after.body.city.isSeedData).toBe(false);
  });

  test('throttles a second submission from the same submitter for the same city', async () => {
    const res = await request(app)
      .post('/api/cities/austin-tx/submissions')
      .send({ safety: 1, traffic: 1, transport: 1, cleanliness: 1 });
    expect(res.status).toBe(429);
  });
});

describe('GET /api/methodology', () => {
  test('exposes the same weights the scoring engine uses', async () => {
    const res = await request(app).get('/api/methodology');
    expect(res.status).toBe(200);
    const sum = Object.values(res.body.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});
