import { TOTP } from 'totp-generator';
import { Page, expect } from '@playwright/test';
require('dotenv').config();

const LOGOUT_PATH = '/logout';

export async function logout(page: Page) {
  await page.goto(LOGOUT_PATH);
  await expect(page.getByTestId('alert-message')).toBeVisible();
  await expect(page.getByTestId('button-login')).toBeVisible();
}

export async function totp(key: string) {
  const { otp, expires } = TOTP.generate(key);
  return { otp, expires };
}

const mfakey = process.env.MFA_KEY;
console.log(mfakey);

totp(mfakey).then(({ otp, expires }) => {
  console.log(otp, expires);
});
