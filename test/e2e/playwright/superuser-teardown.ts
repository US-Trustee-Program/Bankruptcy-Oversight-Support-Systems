import { test } from './fixture/urlQueryString';
import { revokeSuperUser } from './login/superuser-access';
import { SUPERUSER_OKTA_USER_ID } from './superuser';

// Runs after the chromium-superuser project (playwright.config.ts: superuser-setup's `teardown`),
// reverting the temporary grant superuser-auth-setup.ts made so the e2e account ends the run
// non-privileged again.
test('revoke Super User', async () => {
  await revokeSuperUser(SUPERUSER_OKTA_USER_ID);
});
