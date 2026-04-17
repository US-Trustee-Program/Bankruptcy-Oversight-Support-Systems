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
export const TRUSTEE_MANAGEMENT = 'trustee-management';
export const PHONETIC_SEARCH_ENABLED = 'phonetic-search-enabled';
export const SHOW_DEBTOR_NAME_COLUMN = 'show-debtor-name-column';
export const DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES = 'display-chpt7-panel-upcoming-key-dates';
export const TRUSTEE_VERIFICATION_ENABLED = 'trustee-verification-enabled';
export const DISPLAY_TRUSTEE_INFO_CASE = 'display-trustee-info-case';

export default function useFeatureFlags(): FeatureFlagSet {
  const config = getFeatureFlagConfiguration();
  const appConfig = getAppConfiguration();

  if (appConfig.useFakeApi) {
    return testFeatureFlags;
  }

  // E2E testing mode: use test flags without mocking API
  if (appConfig.featureFlagsMode === 'test') {
    return testFeatureFlags;
  }

  if (!config.clientId) {
    return {};
  }

  const featureFlags = useFlags();
  return !featureFlags || Object.keys(featureFlags).length === 0 ? {} : featureFlags;
}
