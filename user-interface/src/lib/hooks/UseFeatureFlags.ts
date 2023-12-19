import { useFlags } from 'launchdarkly-react-client-sdk';
import { defaultFeatureFlags, FeatureFlagSet } from '@common/feature-flags';
import { getFeatureFlagConfiguration } from '../../configuration/featureFlagConfiguration';

export const CHAPTER_ELEVEN_ENABLED = 'chapter-eleven-enabled';
export const CHAPTER_TWELVE_ENABLED = 'chapter-twelve-enabled';

export default function useFeatureFlags(): FeatureFlagSet {
  const config = getFeatureFlagConfiguration();
  console.log(config.clientId);
  if (!config.clientId) return defaultFeatureFlags;

  const featureFlags = useFlags();
  return !featureFlags || Object.keys(featureFlags).length === 0
    ? defaultFeatureFlags
    : featureFlags;
}
