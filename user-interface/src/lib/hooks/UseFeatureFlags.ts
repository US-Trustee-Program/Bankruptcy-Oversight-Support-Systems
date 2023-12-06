import { useFlags } from 'launchdarkly-react-client-sdk';
import config from '@/configuration/featureFlagConfiguration';
import { defaultFeatureFlags, FeatureFlagSet } from '@common/feature-flags';

export const CHAPTER_ELEVEN_ENABLED = 'chapter-eleven-enabled';
export const CHAPTER_TWELVE_ENABLED = 'chapter-twelve-enabled';
export const DOCKET_FILTER_ENABLED = 'docket-filter-enabled';

export default function useFeatureFlags(): FeatureFlagSet {
  if (!config.clientId) return defaultFeatureFlags;

  const featureFlags = useFlags();
  return !featureFlags || Object.keys(featureFlags).length === 0
    ? defaultFeatureFlags
    : featureFlags;
}
