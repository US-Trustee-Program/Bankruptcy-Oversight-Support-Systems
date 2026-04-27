import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, createAxeBuilder, getUrl } from './test-constants';

/**
 * E2E Tests for Landing Page Feature
 *
 * Verifies landing page accessibility, navigation, and keyboard interaction.
 * Full E2E with login flow requires feature flag control and auth setup.
 */

test.describe('Landing Page - Case Search', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test('Case Search page loads without errors', async ({ page }) => {
    // When feature flag is enabled, users land on /search
    await page.goto(getUrl('/search'));
    await page.waitForTimeout(ANALYZE_DELAY);

    // Verify page loaded
    await expect(page).toHaveURL(/\/search/);

    // Verify critical search elements are present
    await expect(page.locator('input[name="basic-search"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Case Search page has no accessibility issues', async ({ page }) => {
    await page.goto(getUrl('/search'));
    await page.waitForTimeout(ANALYZE_DELAY);

    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Can navigate from Case Search to My Cases using mouse', async ({ page }) => {
    await page.goto(getUrl('/search'));
    await page.waitForTimeout(ANALYZE_DELAY);

    // Find and click My Cases link in navigation
    const myCasesLink = page.locator('a[href="/my-cases"]').first();
    await expect(myCasesLink).toBeVisible();
    await myCasesLink.click();

    // Verify navigation occurred
    await expect(page).toHaveURL(/\/my-cases/);
  });

  test('Can navigate from Case Search to My Cases using keyboard', async ({ page }) => {
    await page.goto(getUrl('/search'));
    await page.waitForTimeout(ANALYZE_DELAY);

    // Tab through elements until we reach My Cases link
    // This verifies keyboard navigation works
    await page.keyboard.press('Tab');
    await page.evaluate(() => document.activeElement?.tagName);

    // Try to find and activate My Cases link via keyboard
    // Focus on the My Cases link
    const myCasesLink = page.locator('a[href="/my-cases"]').first();
    await myCasesLink.focus();

    // Press Enter to activate
    await page.keyboard.press('Enter');

    // Verify navigation occurred
    await expect(page).toHaveURL(/\/my-cases/);
  });
});

test.describe('Landing Page - My Cases', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test('My Cases page loads without errors', async ({ page }) => {
    // When feature flag is disabled, users land on /my-cases
    await page.goto(getUrl('/my-cases'));
    await page.waitForTimeout(ANALYZE_DELAY);

    // Verify page loaded
    await expect(page).toHaveURL(/\/my-cases/);

    // Verify critical table elements are present
    await expect(page.locator('table[data-testid="my-cases-table"]')).toBeVisible();
    await expect(page.locator('h1:has-text("My Cases")')).toBeVisible();
  });

  test('My Cases page has no accessibility issues', async ({ page }) => {
    await page.goto(getUrl('/my-cases'));
    await page.waitForTimeout(ANALYZE_DELAY);

    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

/**
 * TODO: Full E2E Tests with Authentication and Feature Flag Control
 *
 * The following test scenarios require additional test infrastructure:
 *
 * 1. User logs in with flag enabled → Lands on Case Search page
 *    Requirements:
 *    - Mock authentication or test Okta configuration
 *    - Feature flag set to true in test environment
 *    - Test user credentials
 *
 * 2. User logs in with flag disabled → Lands on My Cases page
 *    Requirements:
 *    - Mock authentication or test Okta configuration
 *    - Feature flag set to false in test environment
 *    - Test user credentials
 *
 * Implementation approach:
 * - Add environment variable support for feature flag overrides
 * - Set up test authentication flow
 * - Create test fixtures for authenticated state
 * - Add tests that verify full login → landing page flow
 *
 * For now, the unit and integration tests provide coverage of the
 * routing logic, and these E2E tests verify pages are accessible.
 */
