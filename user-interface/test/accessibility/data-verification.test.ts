import test, { expect } from '@playwright/test';
import {
  ANALYZE_DELAY,
  COMPLEX_TEST_TIMEOUT,
  LARGE_VIEWPORT,
  createAxeBuilder,
  getUrl,
} from './test-constants';

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

    // Check accessibility for first accordion
    await page.waitForTimeout(ANALYZE_DELAY);
    let accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Test accordion navigation - open second accordion
    await page.locator('[data-testid="accordion-button-order-list-guid-1"]').click();
    await expect(page.locator('[data-testid="accordion-content-guid-0"]')).toBeHidden();
    await expect(page.locator('[data-testid="accordion-content-guid-1"]')).toBeVisible();

    // Check accessibility for second accordion
    await page.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Open third accordion
    await page.locator('[data-testid="accordion-button-order-list-guid-2"]').click();
    await expect(page.locator('[data-testid="accordion-content-guid-1"]')).toBeHidden();
    await expect(page.locator('[data-testid="accordion-content-guid-2"]')).toBeVisible();

    // Check accessibility for third accordion
    await page.waitForTimeout(ANALYZE_DELAY);
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
    await page.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Fifth accordion
    await page.locator('[data-testid="accordion-button-order-list-guid-4"]').click();
    await expect(page.locator('[data-testid="accordion-content-guid-3"]')).toBeHidden();
    await expect(page.locator('[data-testid="accordion-content-guid-4"]')).toBeVisible();

    // Check accessibility for fifth accordion
    await page.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Sixth accordion
    await page.locator('[data-testid="accordion-button-order-list-guid-5"]').click();
    await expect(page.locator('[data-testid="accordion-content-guid-4"]')).toBeHidden();
    await expect(page.locator('[data-testid="accordion-content-guid-5"]')).toBeVisible();

    // Check accessibility for sixth accordion
    await page.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
