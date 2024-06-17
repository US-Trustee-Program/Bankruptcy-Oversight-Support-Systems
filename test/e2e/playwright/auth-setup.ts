import { test as setup } from '@playwright/test';
import { Page, expect } from '@playwright/test';
require('dotenv').config();

const authFile = 'playwright/.auth/user.json';
const OKTA_USER_NAME = process.env.OKTA_USER_NAME;
const OKTA_PASSWORD = process.env.OKTA_PASSWORD;
const TARGET_HOST = process.env.TARGET_HOST;
const LOGIN_PATH = '/login';

setup('authenticate', async ({ page }) => {
  const { login } = usingAuthenticationProvider();
  await login(page);
});

async function noOp() {}

async function mockLogin(page: Page) {
  await page.goto(TARGET_HOST + LOGIN_PATH);
  await page.getByTestId('button-auo-confirm').click();
  await expect(page.getByTestId('modal-content-login-modal')).toBeVisible();
  await page.getByTestId('radio-role-0-click-target').click();
  await page.getByTestId('button-login-modal-submit-button').click();
  await expect(page.getByTestId('modal-content-login-modal')).not.toBeVisible();
}

async function oktaLogin(page: Page) {
  await page.goto(TARGET_HOST + LOGIN_PATH);
  await page.getByTestId('button-auo-confirm').click();
  await expect(page.locator('#okta-sign-in')).toBeVisible();
  await page.locator('#input28').fill(OKTA_USER_NAME); //The selecors changed when we switched tenants?? find a better way for locators
  await page.locator('#input36').fill(OKTA_PASSWORD);
  await page.locator('.button-primary').click();
  await expect(page).toHaveURL(TARGET_HOST);
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
