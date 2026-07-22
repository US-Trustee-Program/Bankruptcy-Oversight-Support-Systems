import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, COMPLEX_TEST_TIMEOUT, createAxeBuilder } from './test-constants';
import { openFirstTrusteeProfileInNewTab } from './trustee-common';

test.describe('Trustee Staff', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  let trusteeProfilePage;

  test.beforeEach(async ({ page, context }) => {
    trusteeProfilePage = await openFirstTrusteeProfileInNewTab(page, context);
  });

  test('trustee profile with no staff should not have accessibility issues', async () => {
    await trusteeProfilePage.waitForSelector('.trustee-profile-staff-grid', {
      state: 'visible',
    });

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('add staff member form should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const addAnotherButton = trusteeProfilePage.getByTestId('button-add-another-staff-button');
    const editEmptyButton = trusteeProfilePage.getByTestId('button-edit-staff-empty');

    const hasStaff = await addAnotherButton.isVisible().catch(() => false);
    const addButton = hasStaff ? addAnotherButton : editEmptyButton;

    await expect(addButton).toBeVisible();
    await addButton.click();

    await expect(trusteeProfilePage.locator('[data-testid="trustee-staff-form"]')).toBeVisible();

    await expect(trusteeProfilePage.locator('#staff-name')).toBeVisible();
    await expect(trusteeProfilePage.locator('#staff-title')).toBeVisible();
    await expect(trusteeProfilePage.locator('#staff-address1')).toBeVisible();
    await expect(trusteeProfilePage.locator('#staff-city')).toBeVisible();
    await expect(trusteeProfilePage.locator('#staff-state')).toBeVisible();
    await expect(trusteeProfilePage.locator('#staff-zip')).toBeVisible();
    await expect(trusteeProfilePage.locator('#phone-group')).toBeVisible();
    await expect(trusteeProfilePage.locator('#staff-email')).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    let accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    await trusteeProfilePage.locator('#staff-name').fill('Test Staff');
    await trusteeProfilePage.locator('#staff-title').fill('Test Title');
    await trusteeProfilePage.locator('#staff-email').fill('test@example.com');

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('edit staff member form should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await trusteeProfilePage.waitForSelector('[data-testid="staff-name-0"]', {
      state: 'visible',
      timeout: 15000,
    });

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    let accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    const editStaffButton = trusteeProfilePage.getByTestId('button-edit-staff-0');
    await expect(editStaffButton).toBeVisible({ timeout: 15000 });
    await editStaffButton.click();

    await expect(trusteeProfilePage.locator('[data-testid="trustee-staff-form"]')).toBeVisible();
    await expect(trusteeProfilePage.locator('#staff-name')).toBeVisible();
    await expect(trusteeProfilePage.locator('#staff-title')).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    await trusteeProfilePage.locator('#staff-title').fill('Updated Title');

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('delete staff member confirmation modal should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await trusteeProfilePage.waitForSelector('[data-testid="staff-name-0"]', {
      state: 'visible',
    });

    const editStaffButton = trusteeProfilePage.getByTestId('button-edit-staff-0');
    await expect(editStaffButton).toBeVisible();
    await editStaffButton.click();

    await expect(trusteeProfilePage.locator('[data-testid="trustee-staff-form"]')).toBeVisible();

    const deleteButton = trusteeProfilePage.locator('#delete-staff-button');
    if (await deleteButton.isVisible().catch(() => false)) {
      await deleteButton.click();

      await expect(
        trusteeProfilePage.locator('.remove-staff-confirmation-modal').locator('[role="dialog"]'),
      ).toBeVisible();

      await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
      const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('staff member contact information display should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await trusteeProfilePage.waitForSelector('[data-testid="staff-name-0"]', {
      state: 'visible',
    });

    await expect(trusteeProfilePage.locator('[data-testid="staff-name-0"]')).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('multiple staff members display should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await trusteeProfilePage.waitForSelector('[data-testid="staff-name-0"]', {
      state: 'visible',
    });
    await trusteeProfilePage.waitForSelector('[data-testid="staff-name-1"]', {
      state: 'visible',
    });

    for (let i = 0; i < 2; i++) {
      const staffMemberName = trusteeProfilePage.locator(`[data-testid="staff-name-${i}"]`);
      const editButton = trusteeProfilePage.getByTestId(`button-edit-staff-${i}`);

      await expect(staffMemberName).toBeVisible();
      await expect(editButton).toBeVisible();

      const ariaLabel = await editButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toContain('Edit trustee staff member');
    }

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('trustee audit history should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const auditHistoryLink = trusteeProfilePage.locator('a[href*="audit-history"]').first();
    if (await auditHistoryLink.isVisible().catch(() => false)) {
      await auditHistoryLink.click();
      await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);

      await expect(trusteeProfilePage.locator('.case-detail-header')).toBeVisible();

      const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });
});
