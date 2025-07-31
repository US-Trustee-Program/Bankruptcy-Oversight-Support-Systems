import test, { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Case Details', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto(`http://localhost:3000/case-detail/123-12-12345`);
  });

  const CASE_NUMBER_SELECTOR = 'h2.case-number';
  const ANALYZE_DELAY = 1000; // Delay in ms to wait for any transitions to complete to minimize false failures.

  test('case overview should not have accessibility issues', async ({ page }) => {
    expect(page.locator(CASE_NUMBER_SELECTOR)).toBeVisible();

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('trustee and assigned staff should not have accessibility issues', async ({ page }) => {
    expect(page.locator(CASE_NUMBER_SELECTOR)).toBeVisible();

    await page.locator('[data-testid="case-trustee-and-assigned-staff-link"]').click();
    expect(page.locator('.trustee-name')).toBeVisible();

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
