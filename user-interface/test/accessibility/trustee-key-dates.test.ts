import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, COMPLEX_TEST_TIMEOUT, createAxeBuilder } from './test-constants';
import { openFirstTrusteeProfileInNewTab } from './trustee-common';

const CARD_CASES = [
  { label: 'audit/field exam', cardTestId: 'chapter7-panel-audit-field-exam-card' },
  { label: 'trustee performance report', cardTestId: 'chapter7-panel-tpr-card' },
  { label: 'trustee interim report', cardTestId: 'chapter7-panel-tir-card' },
  { label: 'other key dates', cardTestId: 'chapter7-panel-other-key-dates-card' },
];

const EDIT_FORM_CASES = [
  {
    label: 'audit/field exam',
    editButtonPrefix: 'button-edit-chapter7-panel-audit-field-exam-',
    formTestId: 'edit-chapter7-panel-audit-field-exam',
  },
  {
    label: 'trustee performance report',
    editButtonPrefix: 'button-edit-chapter7-panel-tpr-',
    formTestId: 'edit-chapter7-panel-tpr',
  },
  {
    label: 'trustee interim report',
    editButtonPrefix: 'button-edit-chapter7-panel-tir-',
    formTestId: 'edit-chapter7-panel-tir',
  },
  {
    label: 'other key dates',
    editButtonPrefix: 'button-edit-chapter7-panel-other-key-dates-',
    formTestId: 'edit-chapter7-panel-other',
  },
];

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

  for (const { label, cardTestId } of CARD_CASES) {
    test(`${label} card should not have accessibility issues`, async () => {
      test.setTimeout(COMPLEX_TEST_TIMEOUT);

      const card = trusteeProfilePage.locator(`[data-testid="${cardTestId}"]`).first();
      await expect(card).toBeVisible();

      await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
      const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
      expect(accessibilityScanResults.violations).toEqual([]);
    });
  }

  for (const { label, editButtonPrefix, formTestId } of EDIT_FORM_CASES) {
    test(`${label} edit form should not have accessibility issues`, async () => {
      test.setTimeout(COMPLEX_TEST_TIMEOUT);

      const editButton = trusteeProfilePage.locator(`[data-testid^="${editButtonPrefix}"]`).first();
      const isVisible = await editButton.isVisible().catch(() => false);

      if (!isVisible) {
        test.skip();
        return;
      }

      await editButton.click();
      await expect(trusteeProfilePage.locator(`[data-testid="${formTestId}"]`)).toBeVisible();

      await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
      const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
      expect(accessibilityScanResults.violations).toEqual([]);
    });
  }
});
