import { test, expect } from '@playwright/test';

test.describe('Temporary Failing Test', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('should fail to validate exit code behavior', async () => {
    // This test is intentionally failing to validate that the pipeline
    // correctly reports failures with exit code 1.
    // Remove this file after validation.
    expect(true).toBe(false);
  });
});
