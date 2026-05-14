import { testFeatureFlags } from './feature-flags';

describe('feature flag tests', () => {
  test('all testFeatureFlags are enabled for testing', () => {
    const values = Object.values(testFeatureFlags);
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => v === true)).toBe(true);
  });
});
