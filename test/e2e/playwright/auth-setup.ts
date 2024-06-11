import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';
const userName = process.env.OKTA_USER_NAME;
const password = process.env.OKTA_PASSWORD;
const oktaHost = process.env.OKTA_URL;
setup('authenticate', async ({ request }) => {
  // Send authentication request. Replace with your own.
  await request.post(oktaHost, {
    data: {
      username: userName,
      password: password,
      options: {
        multiOptionalFactorEnroll: false,
        warnBeforePasswordExpired: false,
      },
    },
  });
  await request.storageState({ path: authFile });
});
