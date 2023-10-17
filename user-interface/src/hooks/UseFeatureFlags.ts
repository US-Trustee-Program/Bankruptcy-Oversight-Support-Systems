import { useFlags } from 'launchdarkly-react-client-sdk';
import config from '../configuration/featureFlagConfiguration';
import { defaultFeatureFlags, FeatureFlagSet } from '../../../common/src/feature-flags';

export const CHAPTER_TWELVE_ENABLED = 'chapter-twelve-enabled';

export default function useFeatureFlags(): FeatureFlagSet {
  if (!config.clientId) return defaultFeatureFlags;

  const featureFlags = useFlags();
  console.log(featureFlags);
  return !featureFlags || Object.keys(featureFlags).length === 0
    ? defaultFeatureFlags
    : featureFlags;
}
