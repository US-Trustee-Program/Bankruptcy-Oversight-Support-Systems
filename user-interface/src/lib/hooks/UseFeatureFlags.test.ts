import * as sdk from 'launchdarkly-react-client-sdk';
import { FeatureFlagSet, testFeatureFlags } from '@common/feature-flags';
import * as config from '../../configuration/featureFlagConfiguration';
import useFeatureFlags from './UseFeatureFlags';
import { mockConfiguration } from '../testing/mock-configuration';

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
    vi.spyOn(sdk, 'useFlags').mockReturnValue(remoteFeatureFlags);
    vi.spyOn(config, 'getFeatureFlagConfiguration').mockReturnValue({
      clientId: '',
      useExternalProvider: false,
      useCamelCaseFlagKeys: false,
    });
    const featureFlags = useFeatureFlags();
    expect(featureFlags).toEqual({});
  });

  test('should use defaults when an no flags are returned from the service', () => {
    vi.spyOn(sdk, 'useFlags').mockReturnValue({});
    vi.spyOn(config, 'getFeatureFlagConfiguration').mockReturnValue({
      clientId: BOGUS_CLIENT_ID,
      useExternalProvider: true,
      useCamelCaseFlagKeys: false,
    });
    const featureFlags = useFeatureFlags();
    expect(featureFlags).toEqual({});
  });

  test('should use flags returned from the service', () => {
    vi.spyOn(sdk, 'useFlags').mockReturnValue(remoteFeatureFlags);
    vi.spyOn(config, 'getFeatureFlagConfiguration').mockReturnValue({
      clientId: BOGUS_CLIENT_ID,
      useExternalProvider: true,
      useCamelCaseFlagKeys: false,
    });
    const featureFlags = useFeatureFlags();
    expect(featureFlags).toEqual(remoteFeatureFlags);
  });

  test('should use default true flags when CAMS_USE_FAKE_API is true', () => {
    mockConfiguration({ useFakeApi: true });
    vi.spyOn(sdk, 'useFlags').mockRejectedValue(new Error('this should not be called'));
    vi.spyOn(config, 'getFeatureFlagConfiguration').mockReturnValue({
      clientId: BOGUS_CLIENT_ID,
      useExternalProvider: true,
      useCamelCaseFlagKeys: false,
    });
    const featureFlags = useFeatureFlags();
    expect(featureFlags).toEqual(testFeatureFlags);
  });
});
