import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, createAxeBuilder, getUrl } from './test-constants';

test.describe('Case Details', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl('/case-detail/123-12-12345'));
  });

  const CASE_NUMBER_SELECTOR = 'h2.case-number';

  test('case overview should not have accessibility issues', async ({ page }) => {
    expect(page.locator(CASE_NUMBER_SELECTOR)).toBeVisible();

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('trustee and assigned staff should not have accessibility issues', async ({ page }) => {
    expect(page.locator(CASE_NUMBER_SELECTOR)).toBeVisible();

    await page.locator('[data-testid="case-trustee-and-assigned-staff-link"]').click();
    expect(page.locator('.trustee-name')).toBeVisible();

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
