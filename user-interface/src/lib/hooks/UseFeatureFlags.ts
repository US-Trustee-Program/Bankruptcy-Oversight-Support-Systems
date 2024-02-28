import { useFlags } from 'launchdarkly-react-client-sdk';
import { defaultFeatureFlags, FeatureFlagSet } from '@common/feature-flags';
import { getFeatureFlagConfiguration } from '../../configuration/featureFlagConfiguration';

export const CHAPTER_ELEVEN_ENABLED = 'chapter-eleven-enabled';
export const CHAPTER_TWELVE_ENABLED = 'chapter-twelve-enabled';
export const TRANSFER_ORDERS_ENABLED = 'transfer-orders-enabled';
export const CONSOLIDATIONS_ENABLED = 'consolidations-enabled';
export const CONSOLIDATIONS_ASSIGN_ATTORNEYS_ENABLED = 'consolidations-assign-attorney';
export const CONSOLIDATIONS_ADD_CASE_ENABLED = 'consolidations-add-case';

export default function useFeatureFlags(): FeatureFlagSet {
  const config = getFeatureFlagConfiguration();
  if (!config.clientId) return defaultFeatureFlags;

  const featureFlags = useFlags();
  return !featureFlags || Object.keys(featureFlags).length === 0
    ? defaultFeatureFlags
    : featureFlags;
}
