import { useFlags } from 'launchdarkly-react-client-sdk';
import { FeatureFlagSet, testFeatureFlags } from '@common/feature-flags';
import { getFeatureFlagConfiguration } from '@/configuration/featureFlagConfiguration';
import getAppConfiguration from '@/configuration/appConfiguration';

export const CASE_SEARCH_LANDING_PAGE = 'case-search-landing-page';
export const CHAPTER_ELEVEN_ENABLED = 'chapter-eleven-enabled';
export const CHAPTER_TWELVE_ENABLED = 'chapter-twelve-enabled';
export const CONSOLIDATIONS_ENABLED = 'consolidations-enabled';
export const DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES = 'display-chpt7-panel-upcoming-key-dates';
export const PHONETIC_SEARCH_ENABLED = 'phonetic-search-enabled';
export const PRIVILEGED_IDENTITY_MANAGEMENT = 'privileged-identity-management';
export const SHOW_DEBTOR_NAME_COLUMN = 'show-debtor-name-column';
export const SYSTEM_MAINTENANCE_BANNER = 'system-maintenance-banner';
export const TRANSFER_ORDERS_ENABLED = 'transfer-orders-enabled';
export const TRUSTEE_MANAGEMENT = 'trustee-management';
export const TRUSTEE_VERIFICATION_ENABLED = 'trustee-verification-enabled';
export const VIEW_TRUSTEE_ON_CASE = 'view-trustee-on-case';
export const TRUSTEE_SOFTWARE_BANK_DISPLAY = 'trustee-software-bank-display';
export const TRUSTEE_ASSIGNED_STAFF_ENABLED = 'trustee-assigned-staff-enabled';
export const TRUSTEE_DISTRICT_DIVISION = 'trustee-district-division';
export const TRUSTEE_APPOINTMENT_HISTORY_ENABLED = 'trustee-appointment-history-enabled';

export default function useFeatureFlags(): FeatureFlagSet {
  const config = getFeatureFlagConfiguration();
  const appConfig = getAppConfiguration();

  // Always call hooks unconditionally (rules of hooks)
  const featureFlags = useFlags();

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

  return !featureFlags || Object.keys(featureFlags).length === 0 ? {} : featureFlags;
}
