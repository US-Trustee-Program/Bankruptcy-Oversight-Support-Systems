import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, COMPLEX_TEST_TIMEOUT, createAxeBuilder, getUrl } from './test-constants';

test.describe('Search', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl('/search'));
  });

  test('should not have accessibility issues with multiple search scenarios', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);
    await expect(page.locator('.search-screen')).toBeVisible();

    // Scenario 1: Successful search with results
    await page.locator('[data-testid="basic-search-field"]').fill('00-00000');
    await page.locator('#search-submit').click();
    await expect(page.locator('#search-results > table')).toBeVisible();

    // Check accessibility for search results scenario
    await page.waitForTimeout(ANALYZE_DELAY);
    let accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Scenario 2: Search with no results
    await page.locator('[data-testid="basic-search-field"]').fill('11-00000');
    await page.locator('#search-submit').click();
    await expect(page.locator('#no-results-alert')).toBeVisible();

    // Check accessibility for no results scenario
    await page.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Scenario 3: Search with error
    await page.locator('[data-testid="basic-search-field"]').fill('99-99999');
    await page.locator('#search-submit').click();
    await expect(page.locator('#search-error-alert')).toBeVisible();

    // Check accessibility for error scenario
    await page.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
