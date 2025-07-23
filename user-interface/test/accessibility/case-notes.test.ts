import test, { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Case Notes', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  let addCaseNoteButton;

  test.beforeEach(async ({ page }) => {
    await page.goto(`http://localhost:3000/case-detail/999-99-00001/notes`);

    addCaseNoteButton = page.getByTestId('open-modal-button_case-note-add-button');
    await expect(addCaseNoteButton).toBeVisible();
  });

  test('should not have accessibility issues', async ({ page }) => {
    const testNoteTitle = 'Test Note Title';
    const testNoteContent = 'Test Note Content for E2E purposes';

    // Create new draft
    await page.locator('[data-testid="open-modal-button_case-note-add-button"]').click();
    await expect(page.locator('[data-testid="modal-content-case-note-modal"]')).toBeVisible();
    await page.locator('[data-testid="case-note-title-input"]').fill(testNoteTitle);
    await page.locator('[data-testid="editor-content"] > div').fill(testNoteContent);
    await page.reload();
    await expect(page.locator('[data-testid="alert-message-draft-add-note"]')).toBeVisible();

    // Create edit draft
    const editButton = await page.locator(
      '[data-testid="open-modal-button_case-note-edit-button_0"]',
    );
    await editButton.click();
    const noteId = await editButton.getAttribute('data-noteid');
    await expect(page.locator('[data-testid="modal-content-case-note-modal"]')).toBeVisible();
    await page.locator('[data-testid="case-note-title-input"]').fill(testNoteTitle);
    await page.locator('[data-testid="editor-content"] > div').fill(testNoteContent);
    await page.reload();
    await expect(
      page.locator(`[data-testid="alert-message-draft-edit-note-${noteId}"]`),
    ).toBeVisible();

    await page.locator('[data-testid="open-modal-button_case-note-add-button"]').click();
    await expect(page.locator('[data-testid="modal-content-case-note-modal"]')).toBeVisible();
    await page.locator('[data-testid="rich-text-bold-button"]').click();
    await page.waitForTimeout(1000);

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
