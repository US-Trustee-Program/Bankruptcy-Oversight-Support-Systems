import { Page, expect } from '@playwright/test';

const LOGIN_PATH = '/login';
const LOGOUT_PATH = '/logout';

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

export function useAuthentication(_provider: string) {
  return {
    login: mockLogin,
    logout,
  };
}
