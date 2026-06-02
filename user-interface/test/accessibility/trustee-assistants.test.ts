import test, { expect } from '@playwright/test';
import { ANALYZE_DELAY, COMPLEX_TEST_TIMEOUT, createAxeBuilder, getUrl } from './test-constants';

test.describe('Trustee Assistants', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  let trusteeProfilePage;

  test.beforeEach(async ({ page }) => {
    await page.goto(getUrl('/trustees'));
    await page.waitForSelector('[data-testid="trustees-table"]', { state: 'visible' });

    const trusteeProfileLink = page.locator('[data-testid^="trustee-link-"]').first();
    await expect(trusteeProfileLink).toBeVisible();

    await trusteeProfileLink.click();
    await page.waitForLoadState();
    trusteeProfilePage = page;

    await expect(trusteeProfilePage.locator('.case-detail-header')).toBeVisible();
  });

  test('trustee profile with no assistants should not have accessibility issues', async () => {
    await trusteeProfilePage.waitForSelector('.trustee-profile-assistants-grid', {
      state: 'visible',
    });

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('add assistant form should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    const addAnotherButton = trusteeProfilePage.getByTestId('button-add-another-assistant-button');
    const editEmptyButton = trusteeProfilePage.getByTestId('button-edit-assistant-empty');

    const hasAssistants = await addAnotherButton.isVisible().catch(() => false);
    const addButton = hasAssistants ? addAnotherButton : editEmptyButton;

    await expect(addButton).toBeVisible();
    await addButton.click();

    await expect(
      trusteeProfilePage.locator('[data-testid="trustee-assistant-form"]'),
    ).toBeVisible();

    await expect(trusteeProfilePage.locator('#assistant-name')).toBeVisible();
    await expect(trusteeProfilePage.locator('#assistant-title')).toBeVisible();
    await expect(trusteeProfilePage.locator('#assistant-address1')).toBeVisible();
    await expect(trusteeProfilePage.locator('#assistant-city')).toBeVisible();
    await expect(trusteeProfilePage.locator('#assistant-state')).toBeVisible();
    await expect(trusteeProfilePage.locator('#assistant-zip')).toBeVisible();
    await expect(trusteeProfilePage.locator('#assistant-phone')).toBeVisible();
    await expect(trusteeProfilePage.locator('#assistant-email')).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    let accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    await trusteeProfilePage.locator('#assistant-name').fill('Test Assistant');
    await trusteeProfilePage.locator('#assistant-title').fill('Test Title');
    await trusteeProfilePage.locator('#assistant-email').fill('test@example.com');

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('edit assistant form should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await trusteeProfilePage.waitForSelector('[data-testid="assistant-name-0"]', {
      state: 'visible',
      timeout: 15000,
    });

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    let accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    const editAssistantButton = trusteeProfilePage.getByTestId('button-edit-assistant-0');
    await expect(editAssistantButton).toBeVisible({ timeout: 15000 });
    await editAssistantButton.click();

    await expect(
      trusteeProfilePage.locator('[data-testid="trustee-assistant-form"]'),
    ).toBeVisible();
    await expect(trusteeProfilePage.locator('#assistant-name')).toBeVisible();
    await expect(trusteeProfilePage.locator('#assistant-title')).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    await trusteeProfilePage.locator('#assistant-title').fill('Updated Title');

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('delete assistant confirmation modal should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await trusteeProfilePage.waitForSelector('[data-testid="assistant-name-0"]', {
      state: 'visible',
    });

    const editAssistantButton = trusteeProfilePage.getByTestId('button-edit-assistant-0');
    await expect(editAssistantButton).toBeVisible();
    await editAssistantButton.click();

    await expect(
      trusteeProfilePage.locator('[data-testid="trustee-assistant-form"]'),
    ).toBeVisible();

    const deleteButton = trusteeProfilePage.locator('#delete-assistant-button');
    if (await deleteButton.isVisible().catch(() => false)) {
      await deleteButton.click();

      await expect(
        trusteeProfilePage
          .locator('.remove-assistant-confirmation-modal')
          .locator('[role="dialog"]'),
      ).toBeVisible();

      await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
      const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('assistant contact information display should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await trusteeProfilePage.waitForSelector('[data-testid="assistant-name-0"]', {
      state: 'visible',
    });

    await expect(trusteeProfilePage.locator('[data-testid="assistant-name-0"]')).toBeVisible();

    await trusteeProfilePage.waitForTimeout(ANALYZE_DELAY);
    const accessibilityScanResults = await createAxeBuilder(trusteeProfilePage).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('multiple assistants display should not have accessibility issues', async () => {
    test.setTimeout(COMPLEX_TEST_TIMEOUT);

    await trusteeProfilePage.waitForSelector('[data-testid="assistant-name-0"]', {
      state: 'visible',
    });
    await trusteeProfilePage.waitForSelector('[data-testid="assistant-name-1"]', {
      state: 'visible',
    });

    for (let i = 0; i < 2; i++) {
      const assistantName = trusteeProfilePage.locator(`[data-testid="assistant-name-${i}"]`);
      const editButton = trusteeProfilePage.getByTestId(`button-edit-assistant-${i}`);

      await expect(assistantName).toBeVisible();
      await expect(editButton).toBeVisible();

      const ariaLabel = await editButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toContain('Edit assistant');
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
