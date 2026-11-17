import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, createAxeBuilder, getUrl } from './test-constants';

test.describe('Trustee Task Regions admin page', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl('/admin/trustee-task-regions'));
    await page.waitForSelector('[data-testid="trustee-task-regions-table"]', {
      state: 'visible',
    });
  });

  test('regions table with ACMS and DXTR sources should not have accessibility issues', async ({
    page,
  }) => {
    // The fake API returns region 03 as DXTR and every other region as ACMS.
    await expect(page.locator('#change-to-dxtr-02')).toBeVisible();
    await expect(page.getByTestId('trustee-task-regions-table')).toContainText('Using DXTR');

    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('the confirmation dialog should not have accessibility issues', async ({ page }) => {
    await page.locator('#change-to-dxtr-02').click();
    await expect(page.getByText('Change Region 2 to DXTR?')).toBeVisible();
    // Lets the modal's open transition finish before scanning, matching the other a11y tests that
    // scan freshly-opened dialogs/accordions -- otherwise axe can sample a mid-fade-in color.
    await page.waitForTimeout(ANALYZE_DELAY);

    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
