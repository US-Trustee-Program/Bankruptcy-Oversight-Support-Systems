import { CamsUser, getGroupDesignators } from './cams/users';
import { CamsRoleType } from './cams/roles';

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
  'display-chpt12-standing-key-dates': true,
  'display-chpt7-panel-upcoming-key-dates': true,
  'display-chpt11-subv-past-key-dates': true,
  'phonetic-search-enabled': true,
  'privileged-identity-management': true,
  'show-debtor-name-column': true,
  'transfer-orders-enabled': true,
  'trustee-appointment-history-enabled': true,
  'trustee-assigned-staff-enabled': true,
  'trustee-case-list': true,
  'trustee-management': true,
  'trustee-software-bank-display': true,
  'trustee-verification-enabled': true,
  'downstream-staff-assignments-enabled': true,
  'downstream-trustee-appointments-enabled': true,
  'trustee-change-notification-enabled': true,
  'trustee-typed-phones': true,
  'software-vendor-typed-phones': true,
};

export type LaunchDarklyContext = {
  kind: 'user';
  key: string;
  name?: string;
  email?: string;
  roles?: CamsRoleType[];
  officeGroupDesignators?: string[];
};

export function buildLaunchDarklyContext(user: CamsUser): LaunchDarklyContext {
  return {
    kind: 'user',
    key: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
    officeGroupDesignators: getGroupDesignators(user),
  };
}

export const ANONYMOUS_FEATURE_FLAG_CONTEXT = {
  kind: 'user',
  key: 'feature-flag-migration',
  anonymous: true,
} as const;
