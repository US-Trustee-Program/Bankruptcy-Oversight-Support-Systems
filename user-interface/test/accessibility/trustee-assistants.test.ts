import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, COMPLEX_TEST_TIMEOUT, createAxeBuilder, getUrl } from './test-constants';

test.describe('Trustee Assistants', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  let trusteeProfileLink;

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl('/trustees'));
    await page.waitForSelector('[data-testid="trustees-table"]', { state: 'visible' });

    trusteeProfileLink = page.locator('[data-testid^="trustee-link-"]').first();
    await expect(trusteeProfileLink).toBeVisible();
    await trusteeProfileLink.click();

    await expect(page.locator('.case-detail-header')).toBeVisible();
  });

  test('trustee profile with no assistants should not have accessibility issues', async ({
    page,
  }) => {
    await page.waitForSelector('.trustee-assistant-information', { state: 'visible' });

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('add assistant form should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const addAnotherButton = page.getByTestId('button-add-another-assistant-button');
    const editEmptyButton = page.getByTestId('button-edit-assistant-empty');

    const hasAssistants = await addAnotherButton.isVisible().catch(() => false);
    const addButton = hasAssistants ? addAnotherButton : editEmptyButton;

    await expect(addButton).toBeVisible();
    await addButton.click();

    await expect(page.locator('[data-testid="trustee-assistant-form"]')).toBeVisible();

    await expect(page.locator('#assistant-name')).toBeVisible();
    await expect(page.locator('#assistant-title')).toBeVisible();
    await expect(page.locator('#assistant-address1')).toBeVisible();
    await expect(page.locator('#assistant-city')).toBeVisible();
    await expect(page.locator('#assistant-state')).toBeVisible();
    await expect(page.locator('#assistant-zip')).toBeVisible();
    await expect(page.locator('#assistant-phone')).toBeVisible();
    await expect(page.locator('#assistant-email')).toBeVisible();

    await page.waitForTimeout(ANALYZE_DELAY);
    let accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    await page.locator('#assistant-name').fill('Test Assistant');
    await page.locator('#assistant-title').fill('Test Title');
    await page.locator('#assistant-email').fill('test@example.com');

    await page.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('edit assistant form should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await page.waitForSelector('[data-testid="assistant-name-0"]', {
      state: 'visible',
      timeout: 15000,
    });

    await page.waitForTimeout(ANALYZE_DELAY);
    let accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    const editAssistantButton = page.getByTestId('button-edit-assistant-0');
    await expect(editAssistantButton).toBeVisible({ timeout: 15000 });
    await editAssistantButton.click();

    await expect(page.locator('[data-testid="trustee-assistant-form"]')).toBeVisible();
    await expect(page.locator('#assistant-name')).toBeVisible();
    await expect(page.locator('#assistant-title')).toBeVisible();

    await page.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    await page.locator('#assistant-title').fill('Updated Title');

    await page.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('delete assistant confirmation modal should not have accessibility issues', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await page.waitForSelector('[data-testid="assistant-name-0"]', { state: 'visible' });

    const editAssistantButton = page.getByTestId('button-edit-assistant-0');
    await expect(editAssistantButton).toBeVisible();
    await editAssistantButton.click();

    await expect(page.locator('[data-testid="trustee-assistant-form"]')).toBeVisible();

    const deleteButton = page.locator('#delete-assistant-button');
    if (await deleteButton.isVisible().catch(() => false)) {
      await deleteButton.click();

      await expect(
        page.locator('.remove-assistant-confirmation-modal').locator('[role="dialog"]'),
      ).toBeVisible();

      await page.waitForTimeout(ANALYZE_DELAY);
      const accessibilityScanResults = await createAxeBuilder(page).analyze();
      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('assistant contact information display should not have accessibility issues', async ({
    page,
  }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await page.waitForSelector('[data-testid="assistant-name-0"]', { state: 'visible' });

    await expect(page.locator('[data-testid="assistant-name-0"]')).toBeVisible();

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('multiple assistants display should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await page.waitForSelector('[data-testid="assistant-name-0"]', { state: 'visible' });
    await page.waitForSelector('[data-testid="assistant-name-1"]', { state: 'visible' });

    for (let i = 0; i < 2; i++) {
      const assistantName = page.locator(`[data-testid="assistant-name-${i}"]`);
      const editButton = page.getByTestId(`button-edit-assistant-${i}`);

      await expect(assistantName).toBeVisible();
      await expect(editButton).toBeVisible();

      const ariaLabel = await editButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toContain('Edit assistant');
    }

    await page.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(page).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('trustee audit history should not have accessibility issues', async ({ page }) => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const auditHistoryLink = page.locator('a[href*="audit-history"]').first();
    if (await auditHistoryLink.isVisible().catch(() => false)) {
      await auditHistoryLink.click();
      await page.waitForTimeout(ANALYZE_DELAY);

      await expect(page.locator('.case-detail-header')).toBeVisible();

      const accessibilityScanResults = await createAxeBuilder(page).analyze();
      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });
});
