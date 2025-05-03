import { FeatureFlagSet, testFeatureFlags } from '@common/feature-flags';
import * as sdk from 'launchdarkly-react-client-sdk';

import * as config from '../../configuration/featureFlagConfiguration';
import useFeatureFlags from './UseFeatureFlags';

const BOGUS_CLIENT_ID = 'bogus-client-id';

const remoteFeatureFlags: FeatureFlagSet = {
  'remote-flag-1': false,
  'remote-flag-2': true,
};

describe('useFeatureFlag hook', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_PA11Y', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('should use defaults when an api key is not available', () => {
    vi.spyOn(config, 'getFeatureFlagConfiguration').mockReturnValue({
      clientId: '',
      useCamelCaseFlagKeys: false,
      useExternalProvider: false,
    });
    const featureFlags = useFeatureFlags();
    expect(featureFlags).toEqual({});
  });

  test('should use defaults when an no flags are returned from the service', () => {
    vi.spyOn(sdk, 'useFlags').mockReturnValue({});
    vi.spyOn(config, 'getFeatureFlagConfiguration').mockReturnValue({
      clientId: BOGUS_CLIENT_ID,
      useCamelCaseFlagKeys: false,
      useExternalProvider: true,
    });
    const featureFlags = useFeatureFlags();
    expect(featureFlags).toEqual({});
  });

  test('should use flags returned from the service', () => {
    vi.spyOn(sdk, 'useFlags').mockReturnValue(remoteFeatureFlags);
    vi.spyOn(config, 'getFeatureFlagConfiguration').mockReturnValue({
      clientId: BOGUS_CLIENT_ID,
      useCamelCaseFlagKeys: false,
      useExternalProvider: true,
    });
    const featureFlags = useFeatureFlags();
    expect(featureFlags).toEqual(remoteFeatureFlags);
  });

  test('should use default true flags when CAMS_PA11Y is true', () => {
    vi.stubEnv('CAMS_PA11Y', 'true');

    vi.spyOn(sdk, 'useFlags').mockRejectedValue(new Error('this should not be called'));
    vi.spyOn(config, 'getFeatureFlagConfiguration').mockReturnValue({
      clientId: BOGUS_CLIENT_ID,
      useCamelCaseFlagKeys: false,
      useExternalProvider: true,
    });
    const featureFlags = useFeatureFlags();
    expect(featureFlags).toEqual(testFeatureFlags);
  });
});
