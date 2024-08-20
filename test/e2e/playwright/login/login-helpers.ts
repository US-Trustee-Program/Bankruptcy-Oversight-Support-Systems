import { Page, expect } from '@playwright/test';
/* eslint-disable-next-line @typescript-eslint/no-require-imports */
require('dotenv').config();

const LOGOUT_PATH = '/logout';

export async function logout(page: Page) {
  await page.goto(LOGOUT_PATH);
  await expect(page.getByTestId('alert-message')).toBeVisible();
  await expect(page.getByTestId('button-login')).toBeVisible();
}
