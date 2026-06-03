import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, COMPLEX_TEST_TIMEOUT, createAxeBuilder } from './test-constants';
import { openFirstTrusteeProfileInNewTab } from './trustee-common';

test.describe('Trustee Appointment Form', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  let trusteeProfilePage;

  test.beforeEach(async ({ page, context }) => {
    trusteeProfilePage = await openFirstTrusteeProfileInNewTab(page, context);

    await trusteeProfilePage.locator('[data-testid="trustee-appointments-nav-link"]').click();
    await trusteeProfilePage.waitForSelector('#add-appointment-button', { state: 'visible' });
  });

  test('add appointment form should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await trusteeProfilePage.locator('#add-appointment-button').click();
    await trusteeProfilePage.waitForSelector('[data-testid="trustee-appointment-form"]', {
      state: 'visible',
    });

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('add appointment form with district selected should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await trusteeProfilePage.locator('#add-appointment-button').click();
    await trusteeProfilePage.waitForSelector('[data-testid="trustee-appointment-form"]', {
      state: 'visible',
    });

    // Check if the separate district/division fields are present (feature flag ON)
    const districtExpand = trusteeProfilePage.locator('#district-expand');
    const isDistrictVisible = await districtExpand.isVisible().catch(() => false);

    if (!isDistrictVisible) {
      test.skip();
      return;
    }

    // Select a district to enable the division dropdown
    await districtExpand.click();
    const firstDistrictOption = trusteeProfilePage
      .locator('#district-item-list li[role="option"]')
      .first();
    await expect(firstDistrictOption).toBeVisible();
    await firstDistrictOption.click();

    // Wait for division dropdown to become enabled
    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('add appointment form with validation error should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // First check if there are existing appointments that could trigger validation
    const appointmentCards = trusteeProfilePage.locator(
      '.appointment-card-container .appointment-card',
    );
    const hasAppointments = (await appointmentCards.count()) > 0;

    if (!hasAppointments) {
      test.skip();
      return;
    }

    await trusteeProfilePage.locator('#add-appointment-button').click();
    await trusteeProfilePage.waitForSelector('[data-testid="trustee-appointment-form"]', {
      state: 'visible',
    });

    // Select the same district/chapter/type as existing appointment to trigger validation error
    const districtExpand = trusteeProfilePage.locator('#district-expand');
    await districtExpand.click();
    const firstDistrictOption = trusteeProfilePage
      .locator('#district-item-list li[role="option"]')
      .first();
    await expect(firstDistrictOption).toBeVisible();
    await firstDistrictOption.click();

    const chapterExpand = trusteeProfilePage.locator('#chapter-expand');
    await chapterExpand.click();
    const firstChapterOption = trusteeProfilePage
      .locator('#chapter-item-list li[role="option"]')
      .first();
    await expect(firstChapterOption).toBeVisible();
    await firstChapterOption.click();

    // Wait for appointment type to be enabled
    await trusteeProfilePage.waitForSelector('#appointmentType-expand:not([disabled])');
    const appointmentTypeExpand = trusteeProfilePage.locator('#appointmentType-expand');
    await appointmentTypeExpand.click();
    const firstTypeOption = trusteeProfilePage
      .locator('#appointmentType-item-list li[role="option"]')
      .first();
    await expect(firstTypeOption).toBeVisible();
    await firstTypeOption.click();

    // Check if a validation error appeared
    const validationError = trusteeProfilePage.locator('[role="alert"]');
    const hasError = await validationError.isVisible().catch(() => false);

    if (!hasError) {
      test.skip();
      return;
    }

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('edit appointment form should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // Look for an edit button on an existing appointment
    const editButton = trusteeProfilePage.locator('[data-testid^="edit-appointment-"]').first();
    const isVisible = await editButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip();
      return;
    }

    await editButton.click();
    await trusteeProfilePage.waitForSelector('[data-testid="trustee-appointment-form"]', {
      state: 'visible',
    });

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
