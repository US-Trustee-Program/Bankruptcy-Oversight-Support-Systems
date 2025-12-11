import test, { expect } from '@playwright/test';
import {
  ANALYZE_DELAY,
  COMPLEX_TEST_TIMEOUT,
  LARGE_VIEWPORT,
  createAxeBuilder,
  getUrl,
} from './test-constants';

test.describe('Court Docket - Complex Interactions', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.use({ viewport: LARGE_VIEWPORT });

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl('/case-detail/101-23-44461/court-docket/'));
  });

  test('should not have accessibility issues with search and filter interactions', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);
    await expect(page.locator('[id="searchable-docket"]')).toBeVisible();

    // Test basic search field interactions
    await page.locator('#basic-search-field').fill('Motion');
    await page.locator('#basic-search-field').fill('joint');

    // Test document number field
    await page.locator('#document-number-search-field').fill('10000');
    await page.locator('#document-number-search-field').clear();

    // Test facet multi-select interactions
    await page.locator('#facet-multi-select-expand').click();
    await page.locator('#facet-multi-select-combo-box-input').click();

    // Test date range picker
    await page.locator('#docket-date-range-date-start').click();

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
