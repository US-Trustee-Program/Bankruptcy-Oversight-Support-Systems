import { getFeatureFlags } from './feature-flag';
import { createMockApplicationContext } from '../../testing/testing-utilities';

jest.mock('@launchdarkly/node-server-sdk', () => {
  return {
    init: jest.fn().mockReturnValue({
      allFlagsState: jest.fn().mockReturnValue({
        allValues: jest.fn().mockReturnValue({
          'chapter-twelve-enabled': true,
        }),
      }),
      flush: jest.fn(),
      close: jest.fn(),
      waitForInitialization: jest.fn(),
    }),
  };
});

describe('Tests for feature flags', () => {
  test('Should test a known feature flag with known set value', async () => {
    const context = await createMockApplicationContext({ FEATURE_FLAG_SDK_KEY: 'fake-key' });

    const flags = await getFeatureFlags(context.config);
    expect(flags['chapter-twelve-enabled']).toEqual(true);
  });
});
