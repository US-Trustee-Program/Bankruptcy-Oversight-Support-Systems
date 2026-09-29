import test, { expect } from '@playwright/test';
import { COMPLEX_TEST_TIMEOUT, LARGE_VIEWPORT, createAxeBuilder, getUrl } from './test-constants';

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

    // Test facet multi-select interactions - opens dropdown with new HTML
    await page.locator('#facet-multi-select-expand').click();
    await page.locator('#facet-multi-select-combo-box-input').click();
    await expect(page.locator('#facet-multi-select-item-list-container')).toBeVisible();

    // Check accessibility with facet dropdown open
    let accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Test date range picker - focuses the native date input
    await page.locator('#docket-date-range-date-start').click();
    await expect(page.locator('#docket-date-range-date-start')).toBeFocused();

    // Check accessibility with date picker open
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
