import { defaultFeatureFlags } from './feature-flags';

describe('feature flag tests', () => {
  test('should return a map of flag names', () => {
    expect(Object.keys(defaultFeatureFlags)).toHaveLength(4);
  });
});
