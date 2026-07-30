import test, { expect } from '@playwright/test';
import { createAxeBuilder, getUrl } from './test-constants';

test.describe('Home Page', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl('/'));
  });

  test('should not have accessibility issues', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
