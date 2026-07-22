import { vi } from 'vitest';
import * as ld from '@launchdarkly/node-server-sdk';
import { getFeatureFlags } from './feature-flag';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { buildLaunchDarklyContext, testFeatureFlags } from '@common/feature-flags';
import MockData from '@common/cams/test-utilities/mock-data';

type MockLDClient = ReturnType<typeof ld.init>;

describe('Tests for feature flags', () => {
  let allFlagsState: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    allFlagsState = vi.fn().mockReturnValue({
      allValues: vi.fn().mockReturnValue({
        'chapter-twelve-enabled': true,
      }),
    });
    vi.spyOn(ld, 'init').mockReturnValue({
      allFlagsState,
      flush: vi.fn(),
      close: vi.fn(),
      waitForInitialization: vi.fn(),
    } as Partial<MockLDClient> as MockLDClient);
  });

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

  test('returns testFeatureFlags without contacting LaunchDarkly when no feature flag key is configured', async () => {
    const context = await createMockApplicationContext({
      env: { FEATURE_FLAG_SDK_KEY: '' },
    });

    const flags = await getFeatureFlags(context.config);

    expect(flags).toEqual(testFeatureFlags);
    expect(ld.init).not.toHaveBeenCalled();
  });
});
