'use strict';

const { scoreFromTemp, scoreFromAqi, blendAverage, computeOverallScore } = require('../src/services/scoringService');

describe('scoreFromTemp', () => {
  test('peaks near the ideal temperature', () => {
    expect(scoreFromTemp(20)).toBeCloseTo(10, 0);
  });

  test('drops off for extreme cold', () => {
    expect(scoreFromTemp(-10)).toBeLessThan(scoreFromTemp(15));
  });

  test('drops off for extreme heat', () => {
    expect(scoreFromTemp(42)).toBeLessThan(scoreFromTemp(25));
  });
});

describe('scoreFromAqi', () => {
  test('scores "good" AQI highly', () => {
    expect(scoreFromAqi(20)).toBeGreaterThan(9);
  });

  test('scores hazardous AQI near zero', () => {
    expect(scoreFromAqi(400)).toBeLessThanOrEqual(1);
  });

  test('is monotonically non-increasing as AQI rises', () => {
    const points = [10, 50, 75, 100, 150, 200, 300];
    const scores = points.map(scoreFromAqi);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });
});

describe('blendAverage', () => {
  test('first submission becomes the average', () => {
    expect(blendAverage(0, 0, 7)).toBe(7);
  });

  test('blends proportionally with existing count', () => {
    // avg 6 over 3 submissions, new submission of 10 -> (18+10)/4 = 7
    expect(blendAverage(6, 3, 10)).toBe(7);
  });

  test('a single new submission cannot swing the average dramatically at high count', () => {
    const before = 5;
    const after = blendAverage(before, 99, 10);
    expect(after - before).toBeLessThan(0.1);
  });
});

describe('computeOverallScore', () => {
  test('all categories at 10 yields 100', () => {
    const perfect = { weather: 10, airQuality: 10, safety: 10, traffic: 10, transport: 10, cleanliness: 10 };
    expect(computeOverallScore(perfect)).toBe(100);
  });

  test('all categories at 0 yields 0', () => {
    const worst = { weather: 0, airQuality: 0, safety: 0, traffic: 0, transport: 0, cleanliness: 0 };
    expect(computeOverallScore(worst)).toBe(0);
  });

  test('weights the crowd categories more heavily than the fixed ones (65 vs 35)', () => {
    const strongCrowdOnly = { weather: 0, airQuality: 0, safety: 10, traffic: 10, transport: 10, cleanliness: 10 };
    const strongEnvOnly = { weather: 10, airQuality: 10, safety: 0, traffic: 0, transport: 0, cleanliness: 0 };
    expect(computeOverallScore(strongCrowdOnly)).toBeGreaterThan(computeOverallScore(strongEnvOnly));
  });
});
