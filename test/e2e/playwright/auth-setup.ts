import { expect, test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';
const userName = process.env.OKTA_USER_NAME;
const password = process.env.OKTA_PASSWORD;
const OKTA_HOST = 'https://dev-34608149.okta.com/api/v1/authn';
setup('authenticate', async ({ request }) => {
  // Send authentication request. Replace with your own.
  await request.post(OKTA_HOST, {
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
  expect(authFile);
});
