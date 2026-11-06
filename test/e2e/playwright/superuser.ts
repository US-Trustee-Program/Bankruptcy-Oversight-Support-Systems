export const SUPERUSER_AUTH_FILE = 'playwright/.auth/superuser.json';

// Specs that sign in as the shared SuperUser account instead of the regular e2e user.
export const SUPERUSER_SPECS = ['permissions.spec.ts'];

/**
 * True when the SuperUser account can sign in: Okta login, with its credentials set.
 */
export function isSuperUserLoginConfigured(): boolean {
  return (
    (process.env.CAMS_LOGIN_PROVIDER ?? '').toLowerCase() === 'okta' &&
    !!process.env.OKTA_SUPERUSER_USER_NAME &&
    !!process.env.OKTA_SUPERUSER_PASSWORD
  );
}
