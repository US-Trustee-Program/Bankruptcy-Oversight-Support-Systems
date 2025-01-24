import { useFlags } from 'launchdarkly-react-client-sdk';
import { FeatureFlagSet, testFeatureFlags } from '@common/feature-flags';
import { getFeatureFlagConfiguration } from '@/configuration/featureFlagConfiguration';

export const CHAPTER_ELEVEN_ENABLED = 'chapter-eleven-enabled';
export const CHAPTER_TWELVE_ENABLED = 'chapter-twelve-enabled';
export const TRANSFER_ORDERS_ENABLED = 'transfer-orders-enabled';
export const CONSOLIDATIONS_ENABLED = 'consolidations-enabled';
export const CASE_SEARCH_ENABLED = 'case-search-enabled';
export const CASE_NOTES_ENABLED = 'case-notes-enabled';
export const PRIVILEGED_IDENTITY_MANAGEMENT = 'privileged-identity-management';

export default function useFeatureFlags(): FeatureFlagSet {
  const config = getFeatureFlagConfiguration();
  if (import.meta.env['CAMS_PA11Y'] === 'true') return testFeatureFlags;
  if (!config.clientId) return {};

  const featureFlags = useFlags();
  return !featureFlags || Object.keys(featureFlags).length === 0 ? {} : featureFlags;
}
