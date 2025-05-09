import { useFlags } from 'launchdarkly-react-client-sdk';
import { FeatureFlagSet, testFeatureFlags } from '@common/feature-flags';
import { getFeatureFlagConfiguration } from '@/configuration/featureFlagConfiguration';
import getAppConfiguration from '@/configuration/appConfiguration';

export const CASE_NOTES_ENABLED = 'case-notes-enabled';
export const CHAPTER_ELEVEN_ENABLED = 'chapter-eleven-enabled';
export const CHAPTER_TWELVE_ENABLED = 'chapter-twelve-enabled';
export const CONSOLIDATIONS_ENABLED = 'consolidations-enabled';
export const PRIVILEGED_IDENTITY_MANAGEMENT = 'privileged-identity-management';
export const STAFF_ASSIGNMENT_FILTER_ENABLED = 'staff-assignment-filter-enabled';
export const SYSTEM_MAINTENANCE_BANNER = 'system-maintenance-banner';
export const TRANSFER_ORDERS_ENABLED = 'transfer-orders-enabled';

export default function useFeatureFlags(): FeatureFlagSet {
  const config = getFeatureFlagConfiguration();
  if (getAppConfiguration().useFakeApi) {
    return testFeatureFlags;
  }
  if (!config.clientId) {
    return {};
  }

  const featureFlags = useFlags();
  return !featureFlags || Object.keys(featureFlags).length === 0 ? {} : featureFlags;
}
