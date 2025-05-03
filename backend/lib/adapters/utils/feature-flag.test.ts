import { createMockApplicationContext } from '../../testing/testing-utilities';
import { getFeatureFlags } from './feature-flag';

jest.mock('@launchdarkly/node-server-sdk', () => {
  return {
    init: jest.fn().mockReturnValue({
      allFlagsState: jest.fn().mockReturnValue({
        allValues: jest.fn().mockReturnValue({
          'chapter-twelve-enabled': true,
        }),
      }),
      close: jest.fn(),
      flush: jest.fn(),
      waitForInitialization: jest.fn(),
    }),
  };
});

describe('Tests for feature flags', () => {
  test('Should test a known feature flag with known set value', async () => {
    const context = await createMockApplicationContext({
      env: { FEATURE_FLAG_SDK_KEY: 'fake-key' },
    });

    const flags = await getFeatureFlags(context.config);
    expect(flags['chapter-twelve-enabled']).toEqual(true);
  });
});
