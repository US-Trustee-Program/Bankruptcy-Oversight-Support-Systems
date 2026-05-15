import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, COMPLEX_TEST_TIMEOUT, createAxeBuilder, getUrl } from './test-constants';

test.describe('Case Detail Trustee Panel', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);
    await page.goto(getUrl('/case-detail/081-73-34831'));
    await page.locator('[data-testid="case-trustee-info-link"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="case-trustee-info-link"]').click();
    await expect(page.getByTestId('case-detail-trustee-panel')).toBeVisible();
  });

  test('trustee panel should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await expect(page.getByTestId('case-detail-trustee-panel-heading')).toBeVisible();
    await page.waitForTimeout(ANALYZE_DELAY);

    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('past trustees table should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await expect(page.getByTestId('past-trustees-section')).toBeVisible();
    await page.waitForTimeout(ANALYZE_DELAY);

    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
