import { Page, expect } from '@playwright/test';
import { test } from './fixture/urlQueryString';
/* eslint-disable-next-line @typescript-eslint/no-require-imports */
require('dotenv').config();

const authFile = 'playwright/.auth/user.json';
const { OKTA_USER_NAME, OKTA_PASSWORD, TARGET_HOST } = process.env;
const LOGIN_PATH = '/login';
const timeoutOption = { timeout: 30000 };

test('authenticate', async ({ page }) => {
  const { login } = usingAuthenticationProvider();
  await login(page);
});

async function noOp() {}

async function mockLogin(page: Page) {
  const mockAuthResponsePromise = page.waitForResponse(
    async (response) => response.url().includes('api/oauth2/default') && response.ok(),
    timeoutOption,
  );

  await page.goto(TARGET_HOST + LOGIN_PATH);
  await page.getByTestId('button-auo-confirm').click();
  await expect(page.getByTestId('modal-content-login-modal')).toBeVisible();
  await page.getByTestId('button-radio-role-4-click-target').click();
  await page.getByTestId('button-login-modal-submit-button').click();
  await expect(page.getByTestId('modal-content-login-modal')).not.toBeVisible();
  await mockAuthResponsePromise;

  await page.context().storageState({ path: authFile });
  await expect(page.context().storageState({ path: authFile })).toBeDefined();
}

async function oktaLogin(page: Page) {
  await page.goto(TARGET_HOST + LOGIN_PATH);
  await page.getByTestId('button-auo-confirm').click();
  await expect(page.locator('#okta-sign-in')).toBeVisible();

  const username = page.locator('input[name=identifier]').first();
  await username.fill(OKTA_USER_NAME);

  const next = page.locator('input[type=submit]').first();
  await next.click();

  const password = page.locator('input[name="credentials.passcode"]').first();
  await expect(password).toBeVisible();
  await password.fill(OKTA_PASSWORD);

  const submit = page.locator('input[type=submit]').first();
  await submit.click();
  //FLAW: when we return from OKTA we return to the base url without the URL
  await page.waitForURL(TARGET_HOST);
  const state = await page.context().storageState({ path: authFile });
  expect(state).toBeDefined();
  await await page.goto(TARGET_HOST);
  const expectedHost = TARGET_HOST.includes('localhost:3000')
    ? TARGET_HOST
    : `${TARGET_HOST}/?x-ms-routing-name=staging`;
  page.waitForURL(expectedHost);
  await expect(page.getByTestId('app-component-test-id')).toBeVisible();
}

function usingAuthenticationProvider() {
  let loginFunction;
  const provider = process.env.CAMS_LOGIN_PROVIDER ?? 'mock';
  // TODO: Add new login functions as we add new providers.
  switch (provider.toLowerCase()) {
    case 'none':
      loginFunction = noOp;
      break;
    case 'okta':
      loginFunction = oktaLogin;
      break;
    case 'mock':
      loginFunction = mockLogin;
      break;
  }
  return {
    login: loginFunction,
  };
}
