import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, COMPLEX_TEST_TIMEOUT, createAxeBuilder, getUrl } from './test-constants';

test.describe('Trustee Key Dates', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl('/trustees'));
    await page.waitForSelector('[data-testid="trustees-table"]', { state: 'visible' });

    const trusteeProfileLink = page.locator('[data-testid^="trustee-link-"]').first();
    await expect(trusteeProfileLink).toBeVisible();
    await trusteeProfileLink.click();

    await expect(page.locator('.case-detail-header')).toBeVisible();

    await page.locator('[data-testid="trustee-appointments-nav-link"]').click();
    await page.waitForSelector('.appointment-card-container', { state: 'visible' });
  });

  test('past key dates card should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const card = page.locator('[data-testid="past-key-dates-card"]').first();
    const isVisible = await card.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip();
      return;
    }

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('past key dates form should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const editButton = page.locator('#edit-past-key-dates').first();
    const isVisible = await editButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip();
      return;
    }

    await editButton.click();
    await expect(page.locator('[data-testid="edit-past-key-dates"]')).toBeVisible();

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('upcoming key dates card should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const card = page.locator('[data-testid="upcoming-key-dates-card"]').first();
    const isVisible = await card.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip();
      return;
    }

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('upcoming key dates form should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const editButton = page.locator('#edit-upcoming-key-dates').first();
    const isVisible = await editButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip();
      return;
    }

    await editButton.click();
    await expect(page.locator('[data-testid="edit-upcoming-key-dates"]')).toBeVisible();

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('upcoming key dates form with validation errors should not have accessibility issues', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const editButton = page.locator('#edit-upcoming-key-dates').first();
    const isVisible = await editButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip();
      return;
    }

    await editButton.click();
    await expect(page.locator('[data-testid="edit-upcoming-key-dates"]')).toBeVisible();

    await page.locator('#tpr-review-period-start-month').selectOption('04');
    await page.locator('#tpr-review-period-start-day').selectOption('01');
    await page.locator('#save-upcoming-key-dates').click();

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
