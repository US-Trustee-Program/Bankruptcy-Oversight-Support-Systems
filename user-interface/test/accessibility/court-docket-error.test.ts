import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, createAxeBuilder, getUrl } from './test-constants';

test.describe('Court Docket - Error Scenario', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl('/case-detail/123-12-12345/court-docket/'));
  });

  test('should not have accessibility issues when error alert is displayed', async ({ page }) => {
    await expect(page.locator('[data-testid="alert-message"]')).toBeVisible();

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
