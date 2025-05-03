// This internal interface aligns with the LaunchDarkly LDFlagSet interface that
// types the return of the useFlags hook. It is more restrictive than the `any` type
// used for the value which could include JSON / object literal payloads. If we were
// to use JSON feature flag values out of LaunchDarkly then this definition would
// need to be revisited.
export interface FeatureFlagSet {
  [key: string]: boolean | number | string;
}

export const testFeatureFlags: FeatureFlagSet = {
  'case-notes-enabled': true,
  'chapter-eleven-enabled': true,
  'chapter-twelve-enabled': true,
  'consolidations-enabled': true,
  'privileged-identity-management': true,
  'staff-assignment-filter-enabled': true,
  'transfer-orders-enabled': true,
};
