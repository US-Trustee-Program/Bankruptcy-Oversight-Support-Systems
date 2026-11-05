import { defineConfig, devices } from '@playwright/test';
import {
  isSuperUserLoginConfigured,
  SUPERUSER_AUTH_FILE,
  SUPERUSER_SPECS,
} from './playwright/superuser';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
/* eslint-disable-next-line @typescript-eslint/no-require-imports */
require('dotenv').config({ quiet: true });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  expect: {
    timeout: 60000,
  },
  timeout: 120000,
  testDir: './playwright',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 3 : 0,
  /* Stop after 2 failures in CI. */
  maxFailures: process.env.CI ? 2 : undefined,
  /* Opt out of parallel tests on CI. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters. We define the output folder in case the default ever changes. */
  reporter: [['line'], ['html', { outputFolder: 'playwright-report' }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.TARGET_HOST || 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on',

    navigationTimeout: 60000,
    actionTimeout: 15000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'setup',
      testMatch: 'auth-setup.ts',
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
      testIgnore: SUPERUSER_SPECS,
    },
    // The SuperUser specs run only when the shared SuperUser account can sign in.
    ...(isSuperUserLoginConfigured()
      ? [
          {
            name: 'superuser-setup',
            testMatch: 'superuser-auth-setup.ts',
          },
          {
            name: 'chromium-superuser',
            use: { ...devices['Desktop Chrome'], storageState: SUPERUSER_AUTH_FILE },
            dependencies: ['superuser-setup'],
            testMatch: SUPERUSER_SPECS,
          },
        ]
      : []),

    // Microsoft Edge is not available in the Playwright Docker image
    // Only Chromium, Firefox, and WebKit are pre-installed
    // Disabled for containerized E2E tests
    // ...(process.arch !== 'arm64'
    //   ? [
    //       {
    //         name: 'Microsoft Edge',
    //         use: {
    //           ...devices['Desktop Edge'],
    //           channel: 'msedge',
    //           storageState: 'playwright/.auth/user.json',
    //         },
    //         dependencies: ['setup'],
    //       },
    //     ]
    //   : []),
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],
});
