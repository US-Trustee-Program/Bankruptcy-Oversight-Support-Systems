import { test } from './fixture/urlQueryString';
import { oktaLogin } from './login/okta-login';
import { grantSuperUser } from './login/superuser-access';
import { SUPERUSER_AUTH_FILE, SUPERUSER_OKTA_USER_ID, SUPERUSER_OKTA_USER_NAME } from './superuser';

// Grants the regular e2e Okta account a temporary Super User permission, then signs in as it for
// the specs that need SuperUser (Administration). playwright.config.ts adds this project only
// when isSuperUserTestEnabled() — the chromium project's own session was already established (and
// is cached by token) before this grant runs, so it stays non-privileged throughout. The
// superuser-teardown project (this project's `teardown`) revokes the grant afterward.
test('grant Super User and authenticate', async ({ page }) => {
  await grantSuperUser(SUPERUSER_OKTA_USER_ID, SUPERUSER_OKTA_USER_NAME);
  await oktaLogin(page, {
    userName: process.env.OKTA_USER_NAME,
    password: process.env.OKTA_PASSWORD,
    authFile: SUPERUSER_AUTH_FILE,
  });
});
