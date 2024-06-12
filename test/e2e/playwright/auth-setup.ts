import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';
const userName = process.env.OKTA_USER_NAME;
const password = process.env.OKTA_PASSWORD;
const localUrl = 'http://localhost:3000/';
const OKTA_HOST = 'https://dev-34608149.okta.com';
setup('authenticate', async ({ page }) => {
  // Send authentication request. Replace with your own.

  await page.goto(localUrl);
  await page.getByTestId('button-auo-confirm').click();
  await page.screenshot();
  await page.waitForURL(OKTA_HOST);
  await page.locator('#okta-sign-in');
  // await page.screenshot();
  await page.locator('#okta-signin-username').fill(userName);
  await page.locator('#okta-signin-password').fill(password);
  await page.locator('#okta-signin-submit').click();
  // Wait until the page receives the cookies.
  //
  // Sometimes login flow sets cookies in the process of several redirects.
  // Wait for the final URL to ensure that the cookies are actually set.
  await page.waitForURL(localUrl);
  // Alternatively, you can wait until the page reaches a state where all cookies are set.

  // End of authentication steps.

  await page.context().storageState({ path: authFile });
  // await request.post(OKTA_HOST, {
  //   data: {
  //     username: userName,
  //     password: password,
  //     options: {
  //       multiOptionalFactorEnroll: false,
  //       warnBeforePasswordExpired: false,
  //     },
  //   },
  // });
  // await request.storageState({ path: authFile });
  // expect(authFile);
});
