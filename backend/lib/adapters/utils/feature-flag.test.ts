import { vi } from 'vitest';
import { getFeatureFlags } from './feature-flag';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { buildLaunchDarklyContext } from '@common/feature-flags';
import MockData from '@common/cams/test-utilities/mock-data';

const { allFlagsState } = vi.hoisted(() => {
  return {
    allFlagsState: vi.fn().mockReturnValue({
      allValues: vi.fn().mockReturnValue({
        'chapter-twelve-enabled': true,
      }),
    }),
  };
});

vi.mock('@launchdarkly/node-server-sdk', () => {
  return {
    init: vi.fn().mockReturnValue({
      allFlagsState,
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

  test('calls allFlagsState with the anonymous context when no user is provided', async () => {
    const context = await createMockApplicationContext({
      env: { FEATURE_FLAG_SDK_KEY: 'fake-key' },
    });

    await getFeatureFlags(context.config);

    expect(allFlagsState).toHaveBeenCalledWith({
      kind: 'user',
      key: 'feature-flag-migration',
      anonymous: true,
    });
  });

  test('calls allFlagsState with the real user context when a user is provided', async () => {
    const context = await createMockApplicationContext({
      env: { FEATURE_FLAG_SDK_KEY: 'fake-key' },
    });
    const user = MockData.getCamsUser();

    await getFeatureFlags(context.config, user);

    expect(allFlagsState).toHaveBeenCalledWith(buildLaunchDarklyContext(user));
  });
});
