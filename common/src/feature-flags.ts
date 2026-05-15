// This internal interface aligns with the LaunchDarkly LDFlagSet interface that
// types the return of the useFlags hook. It is more restrictive than the `any` type
// used for the value which could include JSON / object literal payloads. If we were
// to use JSON feature flag values out of LaunchDarkly then this definition would
// need to be revisited.
export interface FeatureFlagSet {
  [key: string]: boolean | string | number;
}

export const testFeatureFlags: FeatureFlagSet = {
  'case-search-landing-page': true,
  'chapter-eleven-enabled': true,
  'chapter-twelve-enabled': true,
  'consolidations-enabled': true,
  'display-chpt7-panel-upcoming-key-dates': true,
  'phonetic-search-enabled': true,
  'privileged-identity-management': true,
  'show-debtor-name-column': true,
  'transfer-orders-enabled': true,
  'trustee-assigned-staff-enabled': true,
  'trustee-district-division': true,
  'trustee-management': true,
  'trustee-software-bank-display': true,
  'trustee-verification-enabled': true,
  'view-trustee-on-case': true,
  'downstream-staff-assignments-enabled': true,
};
