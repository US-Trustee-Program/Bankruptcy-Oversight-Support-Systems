import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, createAxeBuilder, getUrl } from './test-constants';

test.describe('Administration > Permissions', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl('/admin/permissions/cams-users'));
    await expect(page.locator('#cams-users-table')).toBeVisible();
  });

  test('CAMS Users table should not have accessibility issues', async ({ page }) => {
    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Add Permission modal should not have accessibility issues', async ({ page }) => {
    await page
      .getByRole('button', { name: /^Add Permission to / })
      .first()
      .click();
    await expect(page.getByTestId('modal-add-permission-modal')).toHaveClass(/is-visible/);
    await page.locator('#textarea-add-permission-modal-reason').fill('New hire');

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
