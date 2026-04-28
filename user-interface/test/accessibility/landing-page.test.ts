import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, createAxeBuilder, getUrl } from './test-constants';

/**
 * E2E Tests for Landing Page Feature
 *
 * Verifies that both potential landing pages (Case Search and My Cases)
 * are accessible and functional.
 */

test.describe('Landing Page - Case Search', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test('Case Search page loads without errors', async ({ page }) => {
    await page.goto(getUrl('/search'));
    await page.waitForTimeout(ANALYZE_DELAY);

    await expect(page).toHaveURL(/\/search/);

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

    const myCasesLink = page.locator('a[href="/my-cases"]').first();
    await expect(myCasesLink).toBeVisible();
    await myCasesLink.click();

    await expect(page).toHaveURL(/\/my-cases/);
  });

  test('Can navigate from Case Search to My Cases using keyboard', async ({ page }) => {
    await page.goto(getUrl('/search'));
    await page.waitForTimeout(ANALYZE_DELAY);

    await page.keyboard.press('Tab');
    await page.evaluate(() => document.activeElement?.tagName);

    const myCasesLink = page.locator('a[href="/my-cases"]').first();
    await myCasesLink.focus();

    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/my-cases/);
  });
});

test.describe('Landing Page - My Cases', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test('My Cases page loads without errors', async ({ page }) => {
    await page.goto(getUrl('/my-cases'));
    await page.waitForTimeout(ANALYZE_DELAY);

    await expect(page).toHaveURL(/\/my-cases/);

    await expect(page.locator('h1:has-text("My Cases")')).toBeVisible();
    await expect(page.locator('#closed-cases-toggle')).toBeVisible();
    await expect(page.locator('h3:has-text("Filters")')).toBeVisible();
  });

  test('My Cases page has no accessibility issues', async ({ page }) => {
    await page.goto(getUrl('/my-cases'));
    await page.waitForTimeout(ANALYZE_DELAY);

    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
