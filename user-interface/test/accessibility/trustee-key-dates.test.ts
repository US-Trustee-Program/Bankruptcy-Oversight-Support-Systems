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

  // Chapter 13 Standing accordion + four themed cards (CAMS-915). The accordion may
  // render closed by default (inactive appointment), so expand it via its own
  // accordion button before scanning, rather than relying on plain visibility.
  async function expandChapter13StandingAccordionIfPresent() {
    const card = trusteeProfilePage
      .locator('[data-testid="chapter13-standing-audit-card"]')
      .first();
    if ((await card.count()) === 0) {
      return false;
    }
    if (await card.isVisible().catch(() => false)) {
      return true;
    }
    const content = trusteeProfilePage
      .locator('[data-testid^="accordion-content-"]')
      .filter({ has: card })
      .first();
    const testId = await content.getAttribute('data-testid');
    const accordionId = testId?.replace('accordion-content-', '');
    if (!accordionId) {
      return false;
    }
    await trusteeProfilePage.locator(`[data-testid="accordion-button-${accordionId}"]`).click();
    return card.isVisible().catch(() => false);
  }

  test('Chapter 13 Standing accordion cards should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const isVisible = await expandChapter13StandingAccordionIfPresent();
    if (!isVisible) {
      test.skip();
      return;
    }

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Chapter 13 Standing Audit edit form should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const isVisible = await expandChapter13StandingAccordionIfPresent();
    if (!isVisible) {
      test.skip();
      return;
    }

    const editButton = trusteeProfilePage.locator('#edit-chapter13-standing-audit-key-dates');
    await editButton.click();
    await expect(
      trusteeProfilePage.locator('[data-testid="edit-chapter13-standing-audit-key-dates"]'),
    ).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Chapter 13 Standing Trustee Performance Report edit form should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const isVisible = await expandChapter13StandingAccordionIfPresent();
    if (!isVisible) {
      test.skip();
      return;
    }

    const editButton = trusteeProfilePage.locator('#edit-chapter13-standing-tpr-key-dates');
    await editButton.click();
    await expect(
      trusteeProfilePage.locator('[data-testid="edit-chapter13-standing-tpr-key-dates"]'),
    ).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Chapter 13 Standing Other edit form should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const isVisible = await expandChapter13StandingAccordionIfPresent();
    if (!isVisible) {
      test.skip();
      return;
    }

    const editButton = trusteeProfilePage.locator('#edit-chapter13-standing-other-key-dates');
    await editButton.click();
    await expect(
      trusteeProfilePage.locator('[data-testid="edit-chapter13-standing-other-key-dates"]'),
    ).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
