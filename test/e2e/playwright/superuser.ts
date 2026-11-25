export const SUPERUSER_AUTH_FILE = 'playwright/.auth/superuser.json';

// Specs that run against a temporary Super User grant on the regular e2e account, instead of the
// non-privileged session the chromium project uses. See login/superuser-access.ts.
// These specs assume cams-role-assignments is on wherever e2e runs: LaunchDarkly Develop and
// Main-Gov in CI, and testFeatureFlags locally (no LaunchDarkly key).
export const SUPERUSER_SPECS = ['permissions.spec.ts'];

/** Mirrors the seed script's guard: the Super User grant may only be written to an e2e database. */
export function isE2eDatabase(dbName: string | undefined): boolean {
  return (dbName ?? '').toLowerCase().includes('e2e');
}

/**
 * True when the superuser-setup/superuser-teardown projects can run: Okta login (so a real grant
 * takes effect at the next login) with its credentials set, and an e2e database to write the grant
 * to.
 */
export function isSuperUserTestEnabled(): boolean {
  return (
    (process.env.CAMS_LOGIN_PROVIDER ?? '').toLowerCase() === 'okta' &&
    !!process.env.OKTA_USER_NAME &&
    !!process.env.OKTA_PASSWORD &&
    !!process.env.MONGO_CONNECTION_STRING &&
    isE2eDatabase(process.env.COSMOS_DATABASE_NAME)
  );
}

/**
 * The regular e2e Okta account (test/e2e/scripts/seed-database.ts's E2E_OKTA_USER_ID), granted
 * Super User for the duration of the chromium-superuser project only.
 */
export const SUPERUSER_OKTA_USER_ID =
  process.env.E2E_OKTA_USER_ID?.trim() || '00uxy9tq2inP2J6BQ697';
export const SUPERUSER_OKTA_USER_NAME = 'E2E Test';
