import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
/* eslint-disable-next-line @typescript-eslint/no-require-imports */
require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  expect: {
    timeout: 60000,
  },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Configure projects for major browsers */
  projects: [
    {
      name: 'setup',
      testMatch: '*setup.ts',
    },
    {
      dependencies: ['setup'],
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
    },

    /* Test against branded browsers. */
    {
      dependencies: ['setup'],
      name: 'Microsoft Edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        storageState: 'playwright/.auth/user.json',
      },
    },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],
  /* Reporter to use. See https://playwright.dev/docs/test-reporters. We define the output folder in case the default ever changes. */
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  /* Retry on CI only */
  retries: process.env.CI ? 3 : 0,
  testDir: './playwright',
  timeout: 60000, //Set Test timeout to 1 minute
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.TARGET_HOST || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',
  },

  /* Opt out of parallel tests on CI. */
  workers: 1,
});
