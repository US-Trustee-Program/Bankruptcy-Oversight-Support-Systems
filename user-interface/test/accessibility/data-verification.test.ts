import test, { expect, Page } from '@playwright/test';
import {
  ANALYZE_DELAY,
  COMPLEX_TEST_TIMEOUT,
  LARGE_VIEWPORT,
  createAxeBuilder,
  getUrl,
} from './test-constants';

/** Narrows the Task Type filter to trustee identity tasks only. */
async function narrowToTrusteeIdentityTasks(page: Page) {
  await page.locator('#task-type-filter .input-container').click();
  await page.locator('[id="option-transfer"]').click();
  await page.locator('[id="option-consolidation"]').click();
  await page.keyboard.press('Escape');
}

// This suite does not scan: the Forbidden / No Office Assigned Stop panels (gated on
// hasValidPermissions/hasOffices in DataVerificationScreen.tsx - would need a differently
// permissioned auth fixture, which the fake-API harness this suite runs against doesn't have),
// the loading spinner (a transient state, not realistically freezable for a scan), or the
// 'no-pending-orders'/'too-many-filters' empty-state Alerts (DataVerificationScreen.tsx ~382-403)
// - the fake-API fixtures always include pending orders, and pendingItemCount there is computed
// over the whole unfiltered list, not the active filter selection, so 'no-pending-orders' can't
// be reached by filter clicks alone; reaching 'too-many-filters' would need a type+status
// combination with zero matching fixture orders, and none exists today. Deliberate omissions, not
// oversights.
test.describe('Data Verification', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.use({ viewport: LARGE_VIEWPORT });

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl('/data-verification/'));
  });

  /** Selects pending/approved/rejected in the Task Status filter, making all orders visible. */
  async function selectAllStatuses(page: Page) {
    await page.locator('#task-status-filter .input-container').click();
    await page.locator('[id="option-pending"]').click();
    await page.locator('[id="option-approved"]').click();
    await page.locator('[id="option-rejected"]').click();
    await page.keyboard.press('Escape');
  }

  test('approve and reject modals for the first task have no accessibility issues', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);
    await expect(page.locator('[data-testid="data-verification-screen"]')).toBeVisible();
    await selectAllStatuses(page);

    await page.locator('[data-testid="accordion-button-order-list-guid-0"]').click();
    await expect(
      page.locator('[data-testid="button-radio-suggested-cases-checkbox-0-click-target"]'),
    ).toBeVisible();
    await page
      .locator('[data-testid="button-radio-suggested-cases-checkbox-0-click-target"]')
      .click();

    // Test approve modal
    await page.locator('#accordion-approve-button-guid-0').click();
    await expect(
      page.locator('[data-testid="button-confirm-modal-confirmation-modal-guid-0-cancel-button"]'),
    ).toBeVisible();
    await page
      .locator('[data-testid="button-confirm-modal-confirmation-modal-guid-0-cancel-button"]')
      .click();

    // Test reject modal with text input
    await page.locator('#accordion-reject-button-guid-0').click();
    await expect(page.locator('#rejection-reason-confirmation-modal-guid-0')).toBeVisible();
    await page.locator('#rejection-reason-confirmation-modal-guid-0').fill('this is only a test');
    await expect(
      page.locator('[data-testid="button-confirm-modal-confirmation-modal-guid-0-cancel-button"]'),
    ).toBeVisible();
    await page
      .locator('[data-testid="button-confirm-modal-confirmation-modal-guid-0-cancel-button"]')
      .click();
    await expect(
      page.locator('[data-testid="button-confirm-modal-confirmation-modal-guid-0-cancel-button"]'),
    ).toBeHidden();

    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  // guid-0/1/2 are transfer orders, guid-3/4/5 are consolidation orders (see mock-api2.ts
  // `orders`) - narrowing the type filter to consolidation only isn't required for guid-3/4/5 to
  // render (the default, unfiltered type selection already shows every type), but it exercises
  // the Task Type ComboBox's own filter-interaction accessibility, matching this suite's original
  // coverage.
  const ACCORDIONS = [
    { index: 0 },
    { index: 1 },
    { index: 2 },
    { index: 3, narrowToConsolidation: true },
    { index: 4 },
    { index: 5 },
  ];

  for (const { index, narrowToConsolidation } of ACCORDIONS) {
    test(`accordion ${index} has no accessibility issues when expanded`, async ({ page }) => {
      test.setTimeout(COMPLEX_TEST_TIMEOUT);
      await expect(page.locator('[data-testid="data-verification-screen"]')).toBeVisible();
      await selectAllStatuses(page);

      if (narrowToConsolidation) {
        await page.locator('#task-type-filter .input-container').click();
        await page.locator('[id="option-transfer"]').click();
        await page.locator('[id="option-trustee-match"]').click();
        await page.keyboard.press('Escape');
      }

      await page.locator(`[data-testid="accordion-button-order-list-guid-${index}"]`).click();
      await expect(page.locator(`[data-testid="accordion-content-guid-${index}"]`)).toBeVisible();

      const accessibilityScanResults = await createAxeBuilder(page).analyze();
      expect(accessibilityScanResults.violations).toEqual([]);
    });
  }

  test('should not have accessibility issues in the trustee identity comparison table and confirmation modal', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);
    // The fake API serves one ambiguous DXTR identity task with two candidates whose street and
    // phone differ from the source record (mock-api2.ts trusteeMatchVerificationDetail).
    const taskId = 'e8c1f0a2-identity-task-multimatch';
    await expect(page.locator('[data-testid="data-verification-screen"]')).toBeVisible();

    await narrowToTrusteeIdentityTasks(page);

    await page.locator(`[data-testid="accordion-button-order-list-${taskId}"]`).click();
    const table = page.locator('[data-testid="trustee-comparison-table"]');
    await expect(table).toBeVisible();
    await expect(table.getByLabel(/differs from the source record/).first()).toBeVisible();

    let accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Open the confirmation modal for the second candidate
    await page.locator('[data-testid="approve-candidate-seed-trustee-match-multi-b"]').click();
    const cancelButton = page.locator(`[id="trustee-confirmation-modal-${taskId}-cancel-button"]`);
    await expect(cancelButton).toBeVisible();
    await expect(page.locator('[data-testid="confirm-match-selected"]')).toBeVisible();
    // Let the modal's fade-in finish so axe doesn't read its text at partial opacity.
    await page.waitForTimeout(ANALYZE_DELAY);

    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should not have accessibility issues in Confirm Trustee Match for a searched trustee', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);
    // The fake API's trustee search returns Riley Searchable (mock-api2.ts trusteeSearchResults),
    // who is not one of this task's candidates.
    const taskId = 'e8c1f0a2-identity-task-multimatch';
    const comboBoxId = `trustee-search-combobox-${taskId}`;
    await expect(page.locator('[data-testid="data-verification-screen"]')).toBeVisible();

    await page.locator('#task-type-filter .input-container').click();
    await page.locator('[id="option-transfer"]').click();
    await page.locator('[id="option-consolidation"]').click();
    await page.keyboard.press('Escape');

    await page.locator(`[data-testid="accordion-button-order-list-${taskId}"]`).click();
    await page.getByRole('button', { name: 'Search for a trustee' }).click();
    await page.locator(`#${comboBoxId}-expand`).click();
    await page.locator(`#${comboBoxId}-combo-box-input`).fill('Riley');
    await page.locator(`[data-testid="${comboBoxId}-option-item-0"]`).click();
    await page.locator(`[id="trustee-search-modal-${taskId}-submit-button"]`).click();

    const cancelButton = page.locator(`[id="trustee-confirmation-modal-${taskId}-cancel-button"]`);
    await expect(cancelButton).toBeVisible();
    await expect(page.locator('[data-testid="confirm-match-selected"]')).toContainText(
      'Riley Searchable',
    );
    // Let the modal's fade-in finish so axe doesn't read its text at partial opacity.
    await page.waitForTimeout(ANALYZE_DELAY);

    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    await cancelButton.click();
    await expect(cancelButton).toBeHidden();
  });

  test('should not have accessibility issues on a caseless identity task', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);
    // The fake API serves one caseless ambiguous DXTR identity task (mock-api2.ts
    // trusteeMatchVerificationCaselessDetail) - no caseId/courtId, no affected cases (CAMS-953
    // Slice 5).
    const taskId = 'e8c1f0a2-identity-task-caseless';
    await expect(page.locator('[data-testid="data-verification-screen"]')).toBeVisible();

    await narrowToTrusteeIdentityTasks(page);

    await page.locator(`[data-testid="accordion-button-order-list-${taskId}"]`).click();
    const content = page.locator(`[data-testid="accordion-content-${taskId}"]`);
    await expect(content.locator('.problem-statement')).toContainText(
      'No cases yet. Cases attach as appointments sync.',
    );

    let accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    await page.locator('[data-testid="approve-candidate-seed-trustee-match-caseless-b"]').click();
    const cancelButton = page.locator(`[id="trustee-confirmation-modal-${taskId}-cancel-button"]`);
    await expect(cancelButton).toBeVisible();
    await expect(page.locator('[data-testid="confirm-match-selected"]')).toContainText(
      'Carter Caselessmatch',
    );
    // Let the modal's fade-in finish so axe doesn't read its text at partial opacity.
    await page.waitForTimeout(ANALYZE_DELAY);

    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    await cancelButton.click();
    await expect(cancelButton).toBeHidden();
  });
});
