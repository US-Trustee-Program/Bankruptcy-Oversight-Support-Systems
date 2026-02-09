import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, COMPLEX_TEST_TIMEOUT, createAxeBuilder, getUrl } from './test-constants';

test.describe('Trustee Assistants (CAMS-686)', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  let trusteeProfileLink;

  test.beforeEach(async ({ page }) => {
    // Navigate to trustees list
    await page.goto(getUrl('/trustees'));
    await page.waitForSelector('[data-testid="trustees-table"]', { state: 'visible' });

    // Navigate to trustee profile
    trusteeProfileLink = page.locator('[data-testid^="trustee-link-"]').first();
    await expect(trusteeProfileLink).toBeVisible();
    await trusteeProfileLink.click();

    // Wait for trustee profile to load
    await expect(page.locator('.case-detail-header')).toBeVisible();
  });

  /**
   * Helper function to create an assistant with the given data
   */

  test('trustee profile with no assistants should not have accessibility issues', async ({
    page,
  }) => {
    // Wait for assistants section to render (empty state)
    await page.waitForSelector('.trustee-assistant-information', { state: 'visible' });

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('add assistant form should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // Click add assistant button
    const addAnotherButton = page.getByTestId('button-add-another-assistant-button');
    const editEmptyButton = page.getByTestId('button-edit-assistant-empty');

    const hasAssistants = await addAnotherButton.isVisible().catch(() => false);
    const addButton = hasAssistants ? addAnotherButton : editEmptyButton;

    await expect(addButton).toBeVisible();
    await addButton.click();

    // Wait for form to render
    await expect(page.locator('[data-testid="trustee-assistant-form"]')).toBeVisible();

    // Verify all form fields are present
    await expect(page.locator('#assistant-name')).toBeVisible();
    await expect(page.locator('#assistant-title')).toBeVisible();
    await expect(page.locator('#assistant-address1')).toBeVisible();
    await expect(page.locator('#assistant-city')).toBeVisible();
    await expect(page.locator('#assistant-state')).toBeVisible();
    await expect(page.locator('#assistant-zip')).toBeVisible();
    await expect(page.locator('#assistant-phone')).toBeVisible();
    await expect(page.locator('#assistant-email')).toBeVisible();

    // Test accessibility of empty form
    await page.waitForTimeout(ANALYZE_DELAY);
    let accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Fill form fields to test filled state accessibility
    await page.locator('#assistant-name').fill('Test Assistant');
    await page.locator('#assistant-title').fill('Test Title');
    await page.locator('#assistant-email').fill('test@example.com');

    // Test accessibility with filled form
    await page.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('edit assistant form should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // Mock data now provides assistants - no need to create one
    // Just wait for assistants to be visible
    await page.waitForSelector('[data-testid="assistant-name-0"]', {
      state: 'visible',
      timeout: 15000,
    });

    // Test accessibility of profile with assistants
    await page.waitForTimeout(ANALYZE_DELAY);
    let accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Click edit on first assistant
    const editAssistantButton = page.getByTestId('button-edit-assistant-0');
    await expect(editAssistantButton).toBeVisible({ timeout: 15000 });
    await editAssistantButton.click();

    // Wait for form to render with data
    await expect(page.locator('[data-testid="trustee-assistant-form"]')).toBeVisible();
    await expect(page.locator('#assistant-name')).toBeVisible();
    await expect(page.locator('#assistant-title')).toBeVisible();

    // Test accessibility of edit form with data
    await page.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Make a change to test form in modified state
    await page.locator('#assistant-title').fill('Updated Title');

    // Test accessibility with modified form
    await page.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('delete assistant confirmation modal should not have accessibility issues', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // Mock data provides assistants - use existing assistant
    await page.waitForSelector('[data-testid="assistant-name-0"]', { state: 'visible' });

    // Click edit button for first assistant
    const editAssistantButton = page.getByTestId('button-edit-assistant-0');
    await expect(editAssistantButton).toBeVisible();
    await editAssistantButton.click();

    await expect(page.locator('[data-testid="trustee-assistant-form"]')).toBeVisible();

    // Click delete button to open confirmation modal
    const deleteButton = page.locator('#delete-assistant-button');
    if (await deleteButton.isVisible().catch(() => false)) {
      await deleteButton.click();

      // Wait for modal to appear
      await expect(
        page.locator('.remove-assistant-confirmation-modal').locator('[role="dialog"]'),
      ).toBeVisible();

      // Test accessibility of delete confirmation modal
      await page.waitForTimeout(ANALYZE_DELAY);
      const accessibilityScanResults = await createAxeBuilder(page).analyze();
      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('assistant contact information display should not have accessibility issues', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // Mock data provides assistants with contact info - verify display is accessible
    await page.waitForSelector('[data-testid="assistant-name-0"]', { state: 'visible' });

    // Verify at least one assistant is displayed
    await expect(page.locator('[data-testid="assistant-name-0"]')).toBeVisible();

    // Test accessibility of contact information display
    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('multiple assistants display should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // Mock data provides 2 assistants - verify multiple display is accessible
    await page.waitForSelector('[data-testid="assistant-name-0"]', { state: 'visible' });
    await page.waitForSelector('[data-testid="assistant-name-1"]', { state: 'visible' });

    // Verify both assistants have edit buttons with proper aria-labels
    for (let i = 0; i < 2; i++) {
      const assistantName = page.locator(`[data-testid="assistant-name-${i}"]`);
      const editButton = page.getByTestId(`button-edit-assistant-${i}`);

      await expect(assistantName).toBeVisible();
      await expect(editButton).toBeVisible();

      // Verify edit button has proper aria-label
      const ariaLabel = await editButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toContain('Edit assistant');
    }

    // Test accessibility with multiple assistants
    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('trustee audit history should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    // Navigate to Change History tab
    const auditHistoryLink = page.locator('a[href*="audit-history"]').first();
    if (await auditHistoryLink.isVisible().catch(() => false)) {
      await auditHistoryLink.click();
      await page.waitForTimeout(ANALYZE_DELAY);

      // Verify audit history page loaded
      await expect(page.locator('.case-detail-header')).toBeVisible();

      // Test accessibility of audit history page
      const accessibilityScanResults = await createAxeBuilder(page).analyze();
      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });
});
