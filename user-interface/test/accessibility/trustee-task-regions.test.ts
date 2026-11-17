import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, createAxeBuilder, getUrl } from './test-constants';

// This suite does not scan the load-error Alert or the switch-failure global alert
// (TrusteeTaskRegions.tsx) -- the fake API's getCaseAppointmentSources and
// patchCaseAppointmentSource handlers (mock-api2.ts) always succeed, so neither state is
// reachable through this harness. Both are covered behaviorally in TrusteeTaskRegions.test.tsx.
// Deliberate omissions, not oversights.
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
    await expect(page.locator('#change-to-dxtr-confirm-modal-heading')).toBeVisible();
    // Lets the modal's open transition finish before scanning, matching the other a11y tests that
    // scan freshly-opened dialogs/accordions -- otherwise axe can sample a mid-fade-in color.
    await page.waitForTimeout(ANALYZE_DELAY);

    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('the post-confirmation success state should not have accessibility issues', async ({
    page,
  }) => {
    await page.locator('#change-to-dxtr-02').click();
    await page.getByRole('button', { name: 'Change to DXTR' }).click();
    // The row's "Using DXTR" text takes focus and a global success alert appears -- the riskiest
    // moment for an a11y regression (programmatic focus onto a non-interactive element, a live
    // alert), so it gets its own scan rather than relying on the pre-confirmation scans above.
    await expect(page.locator('#using-dxtr-02')).toBeFocused();
    await page.waitForTimeout(ANALYZE_DELAY);

    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
