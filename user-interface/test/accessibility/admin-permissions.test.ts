import test, { expect, Page } from '@playwright/test';
import { ANALYZE_DELAY, createAxeBuilder, getUrl } from './test-constants';

async function expectNoViolations(page: Page) {
  await page.waitForTimeout(ANALYZE_DELAY);
  const accessibilityScanResults = await createAxeBuilder(page).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
}

async function openAddPermissionModal(page: Page) {
  await page.locator('#cams-users-table [id^="add-permission-"]').first().click();
  await expect(page.getByTestId('modal-content-add-permission-modal')).toBeVisible();
}

test.describe('Administration > Permissions', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl('/admin/permissions/cams-users'));
    await expect(page.locator('#cams-users-table')).toBeVisible();
  });

  test('CAMS Users table should not have accessibility issues', async ({ page }) => {
    await expectNoViolations(page);
  });

  test('filtered empty state should not have accessibility issues', async ({ page }) => {
    await page.locator('#cams-users-name-filter').fill('no such user');
    await expect(page.locator('#cams-users-empty')).toBeVisible();

    await expectNoViolations(page);
  });

  test('Add Permission modal should not have accessibility issues', async ({ page }) => {
    await openAddPermissionModal(page);

    await expectNoViolations(page);
  });

  test('Add Permission modal with the role list open should not have accessibility issues', async ({
    page,
  }) => {
    await openAddPermissionModal(page);
    await page.locator('#add-permission-modal-role-combo-box-input').click();
    await expect(page.locator('#add-permission-modal-role-item-list')).toBeVisible();

    await expectNoViolations(page);
  });

  test('Add Permission modal with a failed save should not have accessibility issues', async ({
    page,
  }) => {
    await openAddPermissionModal(page);
    // Wait for each list to close before moving on; otherwise typing can land in the open ComboBox.
    // Pick options by value, not position: Super User would remove the office field.
    const choices = [
      { field: 'role', value: 'TrialAttorney' },
      { field: 'office', value: 'USTP_CAMS_Region_2_Office_Manhattan' },
    ];
    for (const { field, value } of choices) {
      await page.locator(`#add-permission-modal-${field}-combo-box-input`).click();
      const option = page.locator(
        `#add-permission-modal-${field}-item-list li[data-value="${value}"]`,
      );
      await expect(option).toBeVisible();
      await option.click();
      await expect(page.locator(`#add-permission-modal-${field}-item-list`)).toBeHidden();
    }
    // The fake API rejects any grant to this user (mock-api2.ts grantPermission), who is always
    // the first row in the CAMS Users table.
    const save = page.getByTestId('button-add-permission-modal-submit-button');
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.locator('#add-permission-modal-error')).toBeVisible();

    await expectNoViolations(page);
  });
});
