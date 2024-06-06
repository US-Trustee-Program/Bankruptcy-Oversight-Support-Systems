import { Page, expect } from '@playwright/test';
require('dotenv').config();

const LOGIN_PATH = '/login';
const LOGOUT_PATH = '/logout';

const provider = process.env.TARGET_HOST ?? 'mock';

async function noOp() {}

async function mockLogin(page: Page) {
  await page.goto(LOGIN_PATH);
  await page.getByTestId('button-auo-confirm').click();
  await expect(page.getByTestId('modal-content-login-modal')).toBeVisible();
  await page.getByTestId('radio-role-0-click-target').click();
  await page.getByTestId('button-login-modal-submit-button').click();
  await expect(page.getByTestId('modal-content-login-modal')).not.toBeVisible();
}

async function logout(page: Page) {
  await page.goto(LOGOUT_PATH);
  await expect(page.getByTestId('alert-message')).toBeVisible();
  await expect(page.getByTestId('button-login')).toBeVisible();
}

export function usingAuthenticationProvider() {
  let loginFunction;

  // TODO: Add new login functions as we add new providers.
  switch (provider.toLowerCase()) {
    case 'none':
      loginFunction = noOp;
      break;
    case 'mock':
    default:
      loginFunction = mockLogin;
  }

  return {
    login: loginFunction,
    logout: provider.toLowerCase() === 'none' ? noOp : logout,
  };
}
