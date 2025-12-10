import { vi } from 'vitest';
import { getFeatureFlags } from './feature-flag';
import { createMockApplicationContext } from '../../testing/testing-utilities';

vi.mock('@launchdarkly/node-server-sdk', () => {
  return {
    init: vi.fn().mockReturnValue({
      allFlagsState: vi.fn().mockReturnValue({
        allValues: vi.fn().mockReturnValue({
          'chapter-twelve-enabled': true,
        }),
      }),
      flush: vi.fn(),
      close: vi.fn(),
      waitForInitialization: vi.fn(),
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
