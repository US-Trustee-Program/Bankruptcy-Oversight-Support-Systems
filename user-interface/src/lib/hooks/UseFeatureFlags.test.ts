import * as sdk from 'launchdarkly-react-client-sdk';
import { FeatureFlagSet, defaultFeatureFlags } from '@common/feature-flags';
import * as config from '../../configuration/featureFlagConfiguration';
import useFeatureFlags from './UseFeatureFlags';

const BOGUS_CLIENT_ID = 'bogus-client-id';

const remoteFeatureFlags: FeatureFlagSet = {
  'test-three': false,
  'test-four': true,
};

describe('useFeatureFlag hook', () => {
  beforeEach(() => {});

  test('should use defaults when an api key is not available', () => {
    vi.spyOn(config, 'getFeatureFlagConfiguration').mockReturnValue({
      clientId: '',
      useExternalProvider: false,
      useCamelCaseFlagKeys: false,
    });
    const featureFlags = useFeatureFlags();
    expect(featureFlags).toEqual(defaultFeatureFlags);
  });

  test('should use defaults when an no flags are returned from the service', () => {
    vi.spyOn(sdk, 'useFlags').mockReturnValue({});
    vi.spyOn(config, 'getFeatureFlagConfiguration').mockReturnValue({
      clientId: BOGUS_CLIENT_ID,
      useExternalProvider: true,
      useCamelCaseFlagKeys: false,
    });
    const featureFlags = useFeatureFlags();
    expect(featureFlags).toEqual(defaultFeatureFlags);
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
});
