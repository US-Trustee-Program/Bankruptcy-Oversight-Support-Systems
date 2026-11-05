import { Page, expect } from '@playwright/test';
import { test } from './fixture/urlQueryString';
import { oktaLogin } from './login/okta-login';
/* eslint-disable-next-line @typescript-eslint/no-require-imports */
require('dotenv').config({ quiet: true });

const authFile = 'playwright/.auth/user.json';
const { OKTA_USER_NAME, OKTA_PASSWORD } = process.env;
if (!process.env.TARGET_HOST) {
  throw new Error('TARGET_HOST environment variable is required for E2E tests');
}
const TARGET_HOST: string = process.env.TARGET_HOST;
const LOGIN_PATH = '/login';
const timeoutOption = { timeout: 60000 };

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

  const meResponsePromise = page.waitForResponse(
    async (response) => response.url().includes('api/me') && response.ok(),
    timeoutOption,
  );

  await page.goto(TARGET_HOST + LOGIN_PATH);
  await page.getByTestId('button-auo-confirm').click();
  await expect(page.getByTestId('modal-content-login-modal')).toBeVisible();
  await page.getByTestId('button-radio-role-12-click-target').click();
  await page.getByTestId('button-login-modal-submit-button').click();
  await expect(page.getByTestId('modal-content-login-modal')).not.toBeVisible();
  await mockAuthResponsePromise;
  await meResponsePromise;

  await page.context().storageState({ path: authFile });
  expect(page.context().storageState({ path: authFile })).toBeDefined();
}

async function oktaUserLogin(page: Page) {
  await oktaLogin(page, { userName: OKTA_USER_NAME, password: OKTA_PASSWORD, authFile });
}

function usingAuthenticationProvider() {
  const provider = process.env.CAMS_LOGIN_PROVIDER ?? 'mock';
  // TODO: Add new login functions as we add new providers.
  switch (provider.toLowerCase()) {
    case 'none':
      return { login: noOp };
    case 'okta':
      return { login: oktaUserLogin };
    case 'mock':
      return { login: mockLogin };
    default:
      throw new Error(`Unrecognized CAMS_LOGIN_PROVIDER: "${provider}"`);
  }
}
