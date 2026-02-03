// This internal interface aligns with the LaunchDarkly LDFlagSet interface that
// types the return of the useFlags hook. It is more restrictive than the `any` type
// used for the value which could include JSON / object literal payloads. If we were
// to use JSON feature flag values out of LaunchDarkly then this definition would
// need to be revisited.
export interface FeatureFlagSet {
  [key: string]: boolean | string | number;
}

export const testFeatureFlags: FeatureFlagSet = {
  'chapter-twelve-enabled': true,
  'chapter-eleven-enabled': true,
  'transfer-orders-enabled': true,
  'consolidations-enabled': true,
  'privileged-identity-management': true,
  'view-trustee-on-case': true,
  'trustee-management': true,
  'phonetic-search-enabled': true,
  'show-debtor-name-column': true,
};
