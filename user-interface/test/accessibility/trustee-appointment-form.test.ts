import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, COMPLEX_TEST_TIMEOUT, createAxeBuilder, getUrl } from './test-constants';

test.describe('Trustee Appointment Form', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl('/trustees'));
    await page.waitForSelector('[data-testid="trustees-table"]', { state: 'visible' });

    const trusteeProfileLink = page.locator('[data-testid^="trustee-link-"]').first();
    await expect(trusteeProfileLink).toBeVisible();
    await trusteeProfileLink.click();

    await expect(page.locator('.case-detail-header')).toBeVisible();

    await page.locator('[data-testid="trustee-appointments-nav-link"]').click();
    await page.waitForSelector('#add-appointment-button', { state: 'visible' });
  });

  test('add appointment form should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await page.locator('#add-appointment-button').click();
    await page.waitForSelector('[data-testid="trustee-appointment-form"]', { state: 'visible' });

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('add appointment form with district selected should not have accessibility issues', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await page.locator('#add-appointment-button').click();
    await page.waitForSelector('[data-testid="trustee-appointment-form"]', { state: 'visible' });

    // Check if the separate district/division fields are present (feature flag ON)
    const districtExpand = page.locator('#district-expand');
    const isDistrictVisible = await districtExpand.isVisible().catch(() => false);

    if (!isDistrictVisible) {
      test.skip();
      return;
    }

    // Select a district to enable the division dropdown
    await districtExpand.click();
    const firstDistrictOption = page.locator('#district-item-list li[role="option"]').first();
    await expect(firstDistrictOption).toBeVisible();
    await firstDistrictOption.click();

    // Wait for division dropdown to become enabled
    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('add appointment form with validation error should not have accessibility issues', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // First check if there are existing appointments that could trigger validation
    const appointmentCards = page.locator('.appointment-card-container .appointment-card');
    const hasAppointments = (await appointmentCards.count()) > 0;

    if (!hasAppointments) {
      test.skip();
      return;
    }

    await page.locator('#add-appointment-button').click();
    await page.waitForSelector('[data-testid="trustee-appointment-form"]', { state: 'visible' });

    // Select the same district/chapter/type as existing appointment to trigger validation error
    const districtExpand = page.locator('#district-expand');
    await districtExpand.click();
    const firstDistrictOption = page.locator('#district-item-list li[role="option"]').first();
    await expect(firstDistrictOption).toBeVisible();
    await firstDistrictOption.click();

    const chapterExpand = page.locator('#chapter-expand');
    await chapterExpand.click();
    const firstChapterOption = page.locator('#chapter-item-list li[role="option"]').first();
    await expect(firstChapterOption).toBeVisible();
    await firstChapterOption.click();

    // Wait for appointment type to be enabled
    await page.waitForSelector('#appointmentType-expand:not([disabled])');
    const appointmentTypeExpand = page.locator('#appointmentType-expand');
    await appointmentTypeExpand.click();
    const firstTypeOption = page.locator('#appointmentType-item-list li[role="option"]').first();
    await expect(firstTypeOption).toBeVisible();
    await firstTypeOption.click();

    // Check if a validation error appeared
    const validationError = page.locator('[role="alert"]');
    const hasError = await validationError.isVisible().catch(() => false);

    if (!hasError) {
      test.skip();
      return;
    }

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('edit appointment form should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // Look for an edit button on an existing appointment
    const editButton = page.locator('[data-testid^="edit-appointment-"]').first();
    const isVisible = await editButton.isVisible().catch(() => false);

    if (!isVisible) {
      test.skip();
      return;
    }

    await editButton.click();
    await page.waitForSelector('[data-testid="trustee-appointment-form"]', { state: 'visible' });

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
