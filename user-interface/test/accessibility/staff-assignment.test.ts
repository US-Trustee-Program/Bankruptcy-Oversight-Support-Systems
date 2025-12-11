import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, createAxeBuilder, getUrl } from './test-constants';

test.describe('Staff Assignment', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl('/staff-assignment/'));
  });

  test('should not have accessibility issues with modal interaction', async ({ page }) => {
    await expect(page.locator('[data-testid="open-modal-button_0"]')).toBeVisible();

    await page.locator('[data-testid="open-modal-button_0"]').click();

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
