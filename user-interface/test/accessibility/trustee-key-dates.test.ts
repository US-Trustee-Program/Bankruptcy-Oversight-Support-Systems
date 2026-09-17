import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, COMPLEX_TEST_TIMEOUT, createAxeBuilder } from './test-constants';
import { openFirstTrusteeProfileInNewTab } from './trustee-common';

// The fake API's only seeded appointment (see MockApi2.getTrusteeAppointments) is a
// Chapter 7 - Panel appointment, which renders via the Chapter 7 Panel accordion body
// (four themed cards) rather than the legacy flat AppointmentCard.
test.describe('Trustee Key Dates', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  let trusteeProfilePage;

  test.beforeEach(async ({ page, context }) => {
    trusteeProfilePage = await openFirstTrusteeProfileInNewTab(page, context);

    await trusteeProfilePage.locator('[data-testid="trustee-appointments-nav-link"]').click();
    await trusteeProfilePage.locator('[data-testid^="accordion-button-"]').first().click();
    await trusteeProfilePage.waitForSelector(
      '[data-testid="chapter7-panel-audit-field-exam-card"]',
      {
        state: 'visible',
      },
    );
  });

  test('audit/field exam card should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const card = trusteeProfilePage
      .locator('[data-testid="chapter7-panel-audit-field-exam-card"]')
      .first();
    await expect(card).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('audit/field exam edit form should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const editButton = trusteeProfilePage
      .locator('[data-testid^="button-edit-chapter7-panel-audit-field-exam-"]')
      .first();
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

  test('trustee performance report card should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const card = trusteeProfilePage.locator('[data-testid="chapter7-panel-tpr-card"]').first();
    await expect(card).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('trustee interim report card should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const card = trusteeProfilePage.locator('[data-testid="chapter7-panel-tir-card"]').first();
    await expect(card).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('other key dates card should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const card = trusteeProfilePage
      .locator('[data-testid="chapter7-panel-other-key-dates-card"]')
      .first();
    await expect(card).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
