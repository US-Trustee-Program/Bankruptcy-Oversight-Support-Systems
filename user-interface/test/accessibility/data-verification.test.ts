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

test.describe('Data Verification', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  test.use({ viewport: LARGE_VIEWPORT });

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl('/data-verification/'));
  });

  test('should not have accessibility issues with filters, accordions, and modals', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);
    await expect(page.locator('[data-testid="data-verification-screen"]')).toBeVisible();

    // Select status filters to make all orders visible
    await page.locator('#task-status-filter .input-container').click();
    await page.locator('[id="option-pending"]').click();
    await page.locator('[id="option-approved"]').click();
    await page.locator('[id="option-rejected"]').click();
    await page.keyboard.press('Escape');

    // Open first accordion and interact with it
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

    // Check accessibility for first accordion
    let accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Test accordion navigation - open second accordion
    await page.locator('[data-testid="accordion-button-order-list-guid-1"]').click();
    await expect(page.locator('[data-testid="accordion-content-guid-0"]')).toBeHidden();
    await expect(page.locator('[data-testid="accordion-content-guid-1"]')).toBeVisible();

    // Check accessibility for second accordion
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Open third accordion
    await page.locator('[data-testid="accordion-button-order-list-guid-2"]').click();
    await expect(page.locator('[data-testid="accordion-content-guid-1"]')).toBeHidden();
    await expect(page.locator('[data-testid="accordion-content-guid-2"]')).toBeVisible();

    // Check accessibility for third accordion
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Narrow type filter to consolidation orders only (deselect transfer and trustee-match)
    await page.locator('#task-type-filter .input-container').click();
    await page.locator('[id="option-transfer"]').click();
    await page.locator('[id="option-trustee-match"]').click();
    await page.keyboard.press('Escape');

    // Continue accordion navigation - fourth accordion
    await page.locator('[data-testid="accordion-button-order-list-guid-3"]').click();
    await expect(page.locator('[data-testid="accordion-content-guid-2"]')).toBeHidden();
    await expect(page.locator('[data-testid="accordion-content-guid-3"]')).toBeVisible();

    // Check accessibility for fourth accordion
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Fifth accordion
    await page.locator('[data-testid="accordion-button-order-list-guid-4"]').click();
    await expect(page.locator('[data-testid="accordion-content-guid-3"]')).toBeHidden();
    await expect(page.locator('[data-testid="accordion-content-guid-4"]')).toBeVisible();

    // Check accessibility for fifth accordion
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Sixth accordion
    await page.locator('[data-testid="accordion-button-order-list-guid-5"]').click();
    await expect(page.locator('[data-testid="accordion-content-guid-4"]')).toBeHidden();
    await expect(page.locator('[data-testid="accordion-content-guid-5"]')).toBeVisible();

    // Check accessibility for sixth accordion
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

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
