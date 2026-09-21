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

// The fake API (see MockApi2.getTrusteeAppointments) seeds a Chapter 7 - Panel
// appointment plus a Chapter 12 and a Chapter 13 Case by Case appointment, so each
// suite below opens the accordion it cares about by heading text rather than by
// position.
test.describe('Trustee Key Dates', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  let trusteeProfilePage;

  test.beforeEach(async ({ page, context }) => {
    trusteeProfilePage = await openFirstTrusteeProfileInNewTab(page, context);

    await trusteeProfilePage.locator('[data-testid="trustee-appointments-nav-link"]').click();
    await trusteeProfilePage
      .locator('[data-testid^="appointment-accordion-header-"]')
      .filter({ hasText: /Chapter 7 - Panel/ })
      .first()
      .click();
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

test.describe('Chapter 12/13 Case by Case Key Dates', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  let trusteeProfilePage;

  /**
   * These appointments render as accordions collapsed by default, so the cards
   * have to be revealed before axe can see them. Returns false when the trustee
   * under test has no such appointment, which lets a test skip rather than fail.
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

  test.beforeEach(async ({ page, context }) => {
    trusteeProfilePage = await openFirstTrusteeProfileInNewTab(page, context);
    await trusteeProfilePage.locator('[data-testid="trustee-appointments-nav-link"]').click();
    await trusteeProfilePage.waitForSelector('[data-testid^="appointment-accordion-header-"]', {
      state: 'visible',
    });
  });

  test('key dates cards should not have accessibility issues', async () => {
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

  test('annual report edit form should not have accessibility issues', async () => {
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

  test('trustee performance report edit form should not have accessibility issues', async () => {
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
