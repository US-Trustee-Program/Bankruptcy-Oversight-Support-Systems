import { useFlags } from 'launchdarkly-react-client-sdk';
import config from '@/configuration/featureFlagConfiguration';
import { defaultFeatureFlags, FeatureFlagSet } from '@common/feature-flags';

export const CHAPTER_TWELVE_ENABLED = 'chapter-twelve-enabled';

export default function useFeatureFlags(): FeatureFlagSet {
  if (!config.clientId) return defaultFeatureFlags;

  const featureFlags = useFlags();
  return !featureFlags || Object.keys(featureFlags).length === 0
    ? defaultFeatureFlags
    : featureFlags;
}
