import { Page, expect } from '@playwright/test';
/* eslint-disable-next-line @typescript-eslint/no-require-imports */
require('dotenv').config({ quiet: true });

const LOGIN_PATH = '/login';

/**
 * Signs in through Okta and saves the browser session to authFile, for a project's storageState.
 */
export async function oktaLogin(
  page: Page,
  { userName, password, authFile }: { userName?: string; password?: string; authFile: string },
) {
  if (!process.env.TARGET_HOST) {
    throw new Error('TARGET_HOST environment variable is required for E2E tests');
  }
  const TARGET_HOST: string = process.env.TARGET_HOST;
  if (!userName || !password) {
    throw new Error(`An Okta user name and password are required to sign in for ${authFile}`);
  }

  await page.goto(TARGET_HOST + LOGIN_PATH);
  await page.getByTestId('button-auo-confirm').click();
  await expect(page.locator('#okta-sign-in')).toBeVisible();

  const username = page.locator('input[name=identifier]').first();
  await username.fill(userName);

  const next = page.locator('input[type=submit]').first();
  await next.click();

  // An account with more than one sign-in method enrolled is first asked to pick one.
  const passcode = page.locator('input[name="credentials.passcode"]').first();
  const choosePassword = page.getByRole('link', { name: 'Select Password.' });
  await expect(passcode.or(choosePassword)).toBeVisible();
  if (await choosePassword.isVisible()) {
    await choosePassword.click();
  }
  await expect(passcode).toBeVisible();
  await page.waitForTimeout(300);
  await passcode.fill(password);

  const submit = page.locator('input[type=submit]').first();
  await submit.click();
  await page.waitForURL(TARGET_HOST);
  const state = await page.context().storageState({ path: authFile });
  expect(state).toBeDefined();
  await page.goto(TARGET_HOST);
  const expectedHost = TARGET_HOST.includes('localhost:3000')
    ? TARGET_HOST
    : `${TARGET_HOST}/?x-ms-routing-name=${
        process.env.SLOT_NAME ||
        (() => {
          throw new Error('SLOT_NAME environment variable is required for E2E tests');
        })()
      }`;
  await page.waitForURL(expectedHost);
  await expect(page.getByTestId('app-component-test-id')).toBeVisible({ timeout: 60000 });
}
