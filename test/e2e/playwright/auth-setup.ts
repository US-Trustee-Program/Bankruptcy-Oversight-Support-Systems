import { test as setup } from '@playwright/test';
import { Page, expect } from '@playwright/test';
require('dotenv').config();

const authFile = 'playwright/.auth/user.json';
const OKTA_USER_NAME = process.env.OKTA_USER_NAME;
const OKTA_PASSWORD = process.env.OKTA_PASSWORD;
const TARGET_HOST = process.env.TARGET_HOST;
const LOGIN_PATH = '/login';
const timeoutOption = { timeout: 30000 };

setup('authenticate', async ({ page }) => {
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
  await page.getByTestId('radio-role-0-click-target').click();
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

  const password = page.locator('input[name="credentials.passcode"]').first();
  await password.fill(OKTA_PASSWORD);

  const submit = page.locator('input[type=submit]').first();
  await submit.click();

  await page.waitForURL(TARGET_HOST);
  await page.context().storageState({ path: authFile });
  await expect(page.context().storageState({ path: authFile })).toBeDefined();
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
