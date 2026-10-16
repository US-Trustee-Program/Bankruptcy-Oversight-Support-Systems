import { CamsUser, getGroupDesignators, getRegionIds } from './cams/users';
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
  'trustee-appointment-accordions': true,
  'phonetic-search-enabled': true,
  'privileged-identity-management': true,
  'restrict-adding-trustees': true,
  'show-debtor-name-column': true,
  'transfer-orders-enabled': true,
  'trustee-appointment-history-enabled': true,
  'trustee-assigned-staff-enabled': true,
  'trustee-case-list': true,
  'trustee-management': true,
  'trustee-software-bank-display': true,
  'trustee-verification-enabled': true,
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
  regionIds?: string[];
};

export function buildLaunchDarklyContext(user: CamsUser): LaunchDarklyContext {
  return {
    kind: 'user',
    key: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
    officeGroupDesignators: getGroupDesignators(user),
    regionIds: getRegionIds(user),
  };
}

export const ANONYMOUS_FEATURE_FLAG_CONTEXT = {
  kind: 'user',
  key: 'feature-flag-migration',
  anonymous: true,
} as const;

// Region ids are unpadded ('1'..'21') to match the offices use case; strip leading zeros so a
// human typing '01' into a flag still matches.
function normalizeRegionId(token: string): string {
  return parseInt(token, 10).toString();
}

/**
 * Resolves a LaunchDarkly string flag into the set of enabled region ids.
 *
 * Grammar: comma-delimited tokens. 'id' and '+id' enable a region, '-id' removes one, and '*'
 * enables every id in allRegionIds. Characters other than digits, ',', '+', '-' and '*' are
 * stripped, and tokens that are not understood contribute nothing. An absent or non-string
 * flag resolves to the empty set.
 */
export function resolveEnabledRegions(flagValue: unknown, allRegionIds: string[]): Set<string> {
  const enabled = new Set<string>();
  if (typeof flagValue !== 'string') return enabled;

  const excluded = new Set<string>();
  const tokens = flagValue
    .replace(/[^\d,+\-*]/g, '')
    .split(',')
    .filter((token) => token.length > 0);

  for (const token of tokens) {
    if (token === '*') {
      allRegionIds.forEach((id) => enabled.add(id));
    } else if (/^-\d+$/.test(token)) {
      excluded.add(normalizeRegionId(token.slice(1)));
    } else if (/^\+?\d+$/.test(token)) {
      enabled.add(normalizeRegionId(token.replace('+', '')));
    }
  }

  excluded.forEach((id) => enabled.delete(id));
  return enabled;
}
