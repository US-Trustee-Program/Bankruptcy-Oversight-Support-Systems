import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, createAxeBuilder, getUrl } from './test-constants';

test.describe('Trustee Data Report admin page', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl('/admin/trustee-data-report'));
    // The fake API starts with one completed report.
    await expect(page.getByTestId('trustee-data-report-results')).toBeVisible();
  });

  async function expectNoViolations(page: Parameters<typeof createAxeBuilder>[0]) {
    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  }

  test('latest results should not have accessibility issues', async ({ page }) => {
    await expectNoViolations(page);
  });

  test('a report in progress should not have accessibility issues', async ({ page }) => {
    await page.getByTestId('button-trustee-data-report-start').click();
    await expect(page.getByTestId('trustee-data-report-active')).toBeVisible();

    await expectNoViolations(page);
  });
});
