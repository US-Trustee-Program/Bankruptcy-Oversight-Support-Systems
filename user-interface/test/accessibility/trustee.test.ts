import test, { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Trustees', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto(`http://localhost:3000/trustees`);
    await page.waitForSelector('[data-testid="trustees-table"]', { state: 'visible' });
  });

  const ANALYZE_DELAY = 1000; // Delay in ms to wait for any transitions to complete to minimize false failures.

  test('trustees list should not have accessibility issues', async ({ page }) => {
    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('trustee profile should not have accessibility issues', async ({ page }) => {
    const trusteeProfileLink = page.locator('[data-testid^="trustee-link-"]').first();
    await expect(trusteeProfileLink).toBeVisible();

    await trusteeProfileLink.click();
    await expect(page.locator('.record-detail-header')).toBeVisible();

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
