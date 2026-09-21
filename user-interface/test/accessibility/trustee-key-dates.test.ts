import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, COMPLEX_TEST_TIMEOUT, createAxeBuilder } from './test-constants';
import { openFirstTrusteeProfileInNewTab } from './trustee-common';

test.describe('Trustee Key Dates', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  let trusteeProfilePage;

  test.beforeEach(async ({ page, context }) => {
    trusteeProfilePage = await openFirstTrusteeProfileInNewTab(page, context);

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

    await trusteeProfilePage.locator('#tpr-review-period-start').fill('2025-04-01');
    await trusteeProfilePage.locator('#save-upcoming-key-dates').click({ force: true });

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  /**
   * Chapter 12 and 13 Case by Case appointments render as accordions that are
   * collapsed by default, so their cards have to be revealed before axe can
   * see them. Returns false when the trustee under test has no such
   * appointment, which lets the caller skip rather than fail.
   */
  async function expandCaseByCaseAccordion(): Promise<boolean> {
    const header = trusteeProfilePage
      .locator('[data-testid^="appointment-accordion-header-"]')
      .filter({ hasText: /Chapter 1[23] - Case by Case/ })
      .first();

    if (!(await header.isVisible().catch(() => false))) {
      return false;
    }

    await header.click();
    await trusteeProfilePage
      .locator('[data-testid^="annual-report-key-dates-card-"]:visible')
      .first()
      .waitFor({ state: 'visible' });
    return true;
  }

  test('Chapter 12/13 Case by Case key dates cards should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    if (!(await expandCaseByCaseAccordion())) {
      test.skip();
      return;
    }

    await expect(
      trusteeProfilePage.locator('[data-testid^="tpr-key-dates-card-"]:visible').first(),
    ).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('annual report key dates form should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    if (!(await expandCaseByCaseAccordion())) {
      test.skip();
      return;
    }

    await trusteeProfilePage
      .locator('[id^="edit-annual-report-key-dates-"]:visible')
      .first()
      .click();
    await expect(
      trusteeProfilePage.locator('[data-testid="edit-annual-report-key-dates"]'),
    ).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('trustee performance report key dates form should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    if (!(await expandCaseByCaseAccordion())) {
      test.skip();
      return;
    }

    await trusteeProfilePage.locator('[id^="edit-tpr-key-dates-"]:visible').first().click();
    await expect(trusteeProfilePage.locator('[data-testid="edit-tpr-key-dates"]')).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('completion status validation error should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    if (!(await expandCaseByCaseAccordion())) {
      test.skip();
      return;
    }

    await trusteeProfilePage
      .locator('[id^="edit-annual-report-key-dates-"]:visible')
      .first()
      .click();
    await expect(
      trusteeProfilePage.locator('[data-testid="edit-annual-report-key-dates"]'),
    ).toBeVisible();

    // A year with no status is the pair validation the form rejects.
    await trusteeProfilePage.locator('#annual-report-completion-year').selectOption({ index: 1 });
    await trusteeProfilePage.locator('#annual-report-completion-status').selectOption('');
    await trusteeProfilePage.locator('#save-annual-report-key-dates').click({ force: true });
    await expect(
      trusteeProfilePage.locator('[data-testid="alert-annual-report-completion-error"]'),
    ).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
