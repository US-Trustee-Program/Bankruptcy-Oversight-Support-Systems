import { useFlags } from 'launchdarkly-react-client-sdk';
import { FeatureFlagSet, testFeatureFlags } from '@common/feature-flags';
import { getFeatureFlagConfiguration } from '@/configuration/featureFlagConfiguration';
import getAppConfiguration from '@/configuration/appConfiguration';

export const CASE_SEARCH_LANDING_PAGE = 'case-search-landing-page';
export const CHAPTER_ELEVEN_ENABLED = 'chapter-eleven-enabled';
export const CHAPTER_TWELVE_ENABLED = 'chapter-twelve-enabled';
export const CONSOLIDATIONS_ENABLED = 'consolidations-enabled';
// Single flag covering the trustee appointments accordion redesign: the
// accordion list, its per-chapter key-dates cards, and the consolidated
// TrusteePerformanceReportForm. Replaces the six per-chapter
// DISPLAY_CHPT*_KEY_DATES flags and TPR_DISPLAY_UPDATES, which all ship together
// in one release.
export const TRUSTEE_APPOINTMENT_ACCORDIONS = 'trustee-appointment-accordions';
export const PHONETIC_SEARCH_ENABLED = 'phonetic-search-enabled';
export const PRIVILEGED_IDENTITY_MANAGEMENT = 'privileged-identity-management';
export const SHOW_DEBTOR_NAME_COLUMN = 'show-debtor-name-column';
export const SYSTEM_MAINTENANCE_BANNER = 'system-maintenance-banner';
export const TRANSFER_ORDERS_ENABLED = 'transfer-orders-enabled';
export const TRUSTEE_MANAGEMENT = 'trustee-management';
// Named for the LaunchDarkly segment it restricts trustee creation to (Office of Oversight), not
// for its own boolean sense -- `true` means the current user IS in that segment and CAN add
// trustees. Use `canAddTrustee()` below instead of reading this flag directly.
export const RESTRICT_ADDING_TRUSTEES = 'restrict-adding-trustees';
export const TRUSTEE_VERIFICATION_ENABLED = 'trustee-verification-enabled';
export const TRUSTEE_SOFTWARE_BANK_DISPLAY = 'trustee-software-bank-display';
export const TRUSTEE_APPOINTMENT_HISTORY_ENABLED = 'trustee-appointment-history-enabled';
export const TRUSTEE_ASSIGNED_STAFF_ENABLED = 'trustee-assigned-staff-enabled';
export const TRUSTEE_CASE_LIST = 'trustee-case-list';
export const TRUSTEE_CHANGE_NOTIFICATIONS = 'trustee-change-notification-enabled';
export const TRUSTEE_TYPED_PHONES = 'trustee-typed-phones';
export const SOFTWARE_VENDOR_TYPED_PHONES = 'software-vendor-typed-phones';

export function isFlagEnabled(flags: FeatureFlagSet, flag: string): boolean {
  return flags[flag] === true;
}

export function canAddTrustee(flags: FeatureFlagSet): boolean {
  return isFlagEnabled(flags, RESTRICT_ADDING_TRUSTEES);
}

export default function useFeatureFlags(): FeatureFlagSet {
  const config = getFeatureFlagConfiguration();
  const appConfig = getAppConfiguration();

  // Always call hooks unconditionally (rules of hooks)
  const featureFlags = useFlags();

  // CAMS_USE_FAKE_API=true is how `npm test` runs, so any test that doesn't
  // explicitly mock this hook's default export gets testFeatureFlags here,
  // not {} or the real LaunchDarkly state. A flag missing from
  // testFeatureFlags reads as false for every such test regardless of
  // intent — mock this hook explicitly for any flag-dependent assertion.
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
