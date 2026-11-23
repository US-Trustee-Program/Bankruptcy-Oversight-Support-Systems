export const SUPERUSER_AUTH_FILE = 'playwright/.auth/superuser.json';

// Specs that run against a temporary Super User grant on the regular e2e account, instead of the
// non-privileged session the chromium project uses. See login/superuser-access.ts.
export const SUPERUSER_SPECS = ['permissions.spec.ts'];

/** Mirrors the seed script's guard: the Super User grant may only be written to an e2e database. */
export function isE2eDatabase(dbName: string | undefined): boolean {
  return (dbName ?? '').toLowerCase().includes('e2e');
}

/**
 * True when the superuser-setup/superuser-teardown projects can run: Okta login (so a real grant
 * takes effect at the next login) with its credentials set, an e2e database to write the grant to,
 * and a backend where cams-role-assignments actually turns on.
 *
 * That last part rules out test/e2e/scripts/run-e2e-workflow.sh's local Podman backend (used both
 * for real local development and for the pr-validation.yml CI job): it never configures a
 * LaunchDarkly key, so backend/lib/adapters/utils/feature-flag.ts's keyless fallback
 * (flagsWithoutLaunchDarkly) forces the flag off, and the grant this test writes is never read. Set
 * CAMS_ROLE_ASSIGNMENTS_ENABLED=true only where the flag is actually on - today, only the Azure
 * branch-deploy backend .github/workflows/reusable-e2e.yml tests against.
 */
export function isSuperUserTestEnabled(): boolean {
  return (
    (process.env.CAMS_LOGIN_PROVIDER ?? '').toLowerCase() === 'okta' &&
    !!process.env.OKTA_USER_NAME &&
    !!process.env.OKTA_PASSWORD &&
    !!process.env.MONGO_CONNECTION_STRING &&
    isE2eDatabase(process.env.COSMOS_DATABASE_NAME) &&
    process.env.CAMS_ROLE_ASSIGNMENTS_ENABLED === 'true'
  );
}

/**
 * The regular e2e Okta account (test/e2e/scripts/seed-database.ts's E2E_OKTA_USER_ID), granted
 * Super User for the duration of the chromium-superuser project only.
 */
export const SUPERUSER_OKTA_USER_ID =
  process.env.E2E_OKTA_USER_ID?.trim() || '00uxy9tq2inP2J6BQ697';
export const SUPERUSER_OKTA_USER_NAME = 'E2E Test';
