import { test } from './fixture/urlQueryString';
import { oktaLogin } from './login/okta-login';
import { SUPERUSER_AUTH_FILE } from './superuser';

// Signs in as the shared SuperUser account for the specs that need SuperUser (Administration).
// playwright.config.ts adds this project only when OKTA_SUPERUSER_USER_NAME and
// OKTA_SUPERUSER_PASSWORD are set.
test('authenticate as SuperUser', async ({ page }) => {
  await oktaLogin(page, {
    userName: process.env.OKTA_SUPERUSER_USER_NAME,
    password: process.env.OKTA_SUPERUSER_PASSWORD,
    authFile: SUPERUSER_AUTH_FILE,
  });
});
