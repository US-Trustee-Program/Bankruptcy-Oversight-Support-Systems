import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, createAxeBuilder, getUrl } from './test-constants';

test.describe('My Cases', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl('/my-cases'));
  });

  test('should not have accessibility issues with modal interaction', async ({ page }) => {
    await expect(page.locator('[data-testid="open-modal-button"]')).toBeVisible();
    await expect(page.locator('#search-results-table-body')).toBeVisible();

    // Open modal and check accessibility with modal open
    await page.locator('[data-testid="open-modal-button"]').click();
    await expect(page.locator('#info-modal-heading')).toBeVisible();
    await expect(page.locator('#info-modal-cancel-button')).toBeVisible();

    await page.waitForTimeout(ANALYZE_DELAY);
    let accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Close modal and check accessibility with modal closed
    await page.locator('#info-modal-cancel-button').click();

    await page.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
