import { useFlags } from 'launchdarkly-react-client-sdk';
import { FeatureFlagSet, testFeatureFlags } from '@common/feature-flags';
import { getFeatureFlagConfiguration } from '@/configuration/featureFlagConfiguration';
import getAppConfiguration from '@/configuration/appConfiguration';

export const CHAPTER_ELEVEN_ENABLED = 'chapter-eleven-enabled';
export const CHAPTER_TWELVE_ENABLED = 'chapter-twelve-enabled';
export const CONSOLIDATIONS_ENABLED = 'consolidations-enabled';
export const PRIVILEGED_IDENTITY_MANAGEMENT = 'privileged-identity-management';
export const SYSTEM_MAINTENANCE_BANNER = 'system-maintenance-banner';
export const TRANSFER_ORDERS_ENABLED = 'transfer-orders-enabled';
export const FORMAT_CASE_NOTES = 'format-case-notes';
export const VIEW_TRUSTEE_ON_CASE = 'view-trustee-on-case';
export const TRUSTEE_MANAGEMENT = 'trustee-management';

export default function useFeatureFlags(): FeatureFlagSet {
  const config = getFeatureFlagConfiguration();
  const featureFlags = useFlags();
  if (getAppConfiguration().useFakeApi) {
    return testFeatureFlags;
  }
  if (!config.clientId) {
    return {};
  }

  return !featureFlags || Object.keys(featureFlags).length === 0 ? {} : featureFlags;
}
