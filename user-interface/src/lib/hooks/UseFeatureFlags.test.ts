import * as sdk from 'launchdarkly-react-client-sdk';
import { FeatureFlagSet, testFeatureFlags } from '@common/feature-flags';
import * as config from '../../configuration/featureFlagConfiguration';
import useFeatureFlags, * as FeatureFlags from './UseFeatureFlags';
import { mockConfiguration } from '../testing/mock-configuration';
import { renderHook } from '@testing-library/react';

const BOGUS_CLIENT_ID = 'bogus-client-id';

const remoteFeatureFlags: FeatureFlagSet = {
  'remote-flag-1': false,
  'remote-flag-2': true,
};

describe('useFeatureFlag hook', () => {
  beforeEach(() => {
    mockConfiguration({ useFakeApi: false });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('should use defaults when an api key is not available', () => {
    vi.spyOn(config, 'getFeatureFlagConfiguration').mockReturnValue({
      clientId: '',
      useExternalProvider: false,
      useCamelCaseFlagKeys: false,
    });
    vi.spyOn(sdk, 'useFlags').mockReturnValue({});
    const { result } = renderHook(() => useFeatureFlags());
    expect(result.current).toEqual({});
  });

  test('should use defaults when an no flags are returned from the service', () => {
    vi.spyOn(sdk, 'useFlags').mockReturnValue({});
    vi.spyOn(config, 'getFeatureFlagConfiguration').mockReturnValue({
      clientId: BOGUS_CLIENT_ID,
      useExternalProvider: true,
      useCamelCaseFlagKeys: false,
    });
    const { result } = renderHook(() => useFeatureFlags());
    expect(result.current).toEqual({});
  });

  test('should use flags returned from the service', () => {
    vi.spyOn(sdk, 'useFlags').mockReturnValue(remoteFeatureFlags);
    vi.spyOn(config, 'getFeatureFlagConfiguration').mockReturnValue({
      clientId: BOGUS_CLIENT_ID,
      useExternalProvider: true,
      useCamelCaseFlagKeys: false,
    });
    const { result } = renderHook(() => useFeatureFlags());
    expect(result.current).toEqual(remoteFeatureFlags);
  });

  test('should use default true flags when CAMS_USE_FAKE_API is true', () => {
    mockConfiguration({ useFakeApi: true });
    vi.spyOn(sdk, 'useFlags').mockReturnValue({});
    vi.spyOn(config, 'getFeatureFlagConfiguration').mockReturnValue({
      clientId: BOGUS_CLIENT_ID,
      useExternalProvider: true,
      useCamelCaseFlagKeys: false,
    });
    const { result } = renderHook(() => useFeatureFlags());
    expect(result.current).toEqual(testFeatureFlags);
  });

  // Flag-name constants are UseFeatureFlags' string-valued exports; its other
  // exports (the hook and its two helper functions) are functions. Filtering
  // on type isolates every flag automatically, so a newly added flag is
  // covered here without editing this file.
  const flagConstants = Object.values(FeatureFlags).filter(
    (value) => typeof value === 'string',
  ) as string[];

  // system-maintenance-banner carries the banner's message text rather than a
  // boolean (Header.tsx renders its raw value), so omitting it from
  // testFeatureFlags -- same as every real environment where no maintenance
  // is scheduled -- is the correct default, not a gap. It's excluded here
  // rather than left to silently fail the loop below.
  const booleanFlagConstants = flagConstants.filter(
    (flag) => flag !== FeatureFlags.SYSTEM_MAINTENANCE_BANNER,
  );

  test.each(booleanFlagConstants)('testFeatureFlags includes %s as true', (flag) => {
    expect(testFeatureFlags[flag]).toBe(true);
  });

  test('testFeatureFlags intentionally omits system-maintenance-banner', () => {
    expect(FeatureFlags.SYSTEM_MAINTENANCE_BANNER in testFeatureFlags).toBe(false);
  });
});
