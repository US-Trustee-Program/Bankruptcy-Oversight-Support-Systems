import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, COMPLEX_TEST_TIMEOUT, createAxeBuilder, getUrl } from './test-constants';

test.describe('Trustee Key Dates', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  let trusteeProfilePage;

  test.beforeEach(async ({ page, context }) => {
    await page.goto(getUrl('/trustees'));
    await page.waitForSelector('[data-testid="trustees-table"]', { state: 'visible' });

    const trusteeProfileLink = page.locator('[data-testid^="trustee-link-"]').first();
    await expect(trusteeProfileLink).toBeVisible();

    // Handle new tab opening (feature flag: open-trustee-profile-in-new-tab)
    const [newPage] = await Promise.all([context.waitForEvent('page'), trusteeProfileLink.click()]);
    await newPage.waitForLoadState();
    trusteeProfilePage = newPage;

    await expect(trusteeProfilePage.locator('.case-detail-header')).toBeVisible();

    await trusteeProfilePage.locator('[data-testid="trustee-appointments-nav-link"]').click();
    await trusteeProfilePage.waitForSelector('.appointment-card-container', { state: 'visible' });
  });

  test('past key dates card should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const card = trusteeProfilePage.locator('[data-testid="past-key-dates-card"]').first();
    const isVisible = await card.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip();
      return;
    }

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('past key dates form should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const editButton = trusteeProfilePage.locator('#edit-past-key-dates').first();
    const isVisible = await editButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip();
      return;
    }

    await editButton.click();
    await expect(trusteeProfilePage.locator('[data-testid="edit-past-key-dates"]')).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('upcoming key dates card should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const card = trusteeProfilePage.locator('[data-testid="upcoming-key-dates-card"]').first();
    const isVisible = await card.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip();
      return;
    }

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('upcoming key dates form should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const editButton = trusteeProfilePage.locator('#edit-upcoming-key-dates').first();
    const isVisible = await editButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip();
      return;
    }

    await editButton.click();
    await expect(
      trusteeProfilePage.locator('[data-testid="edit-upcoming-key-dates"]'),
    ).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('upcoming key dates form with validation errors should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const editButton = trusteeProfilePage.locator('#edit-upcoming-key-dates').first();
    const isVisible = await editButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip();
      return;
    }

    await editButton.click();
    await expect(
      trusteeProfilePage.locator('[data-testid="edit-upcoming-key-dates"]'),
    ).toBeVisible();

    await trusteeProfilePage.locator('#tpr-review-period-start-month').selectOption('04');
    await trusteeProfilePage.locator('#tpr-review-period-start-day').selectOption('01');
    await trusteeProfilePage.locator('#save-upcoming-key-dates').click();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
