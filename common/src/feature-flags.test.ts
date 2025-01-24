import { testFeatureFlags } from './feature-flags';

describe('feature flag tests', () => {
  test('should return a map of flag names', () => {
    expect(Object.keys(testFeatureFlags)).toBeTruthy();
  });
});
