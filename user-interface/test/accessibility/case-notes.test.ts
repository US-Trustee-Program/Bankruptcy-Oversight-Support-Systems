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

    //Open Add Note modal to create a new note and submit
    await page.locator('[data-testid="open-modal-button_case-note-add-button"]').click();
    await expect(page.locator('[data-testid="modal-content-case-note-modal"]')).toBeVisible();

    await page.locator('[data-testid="case-note-title-input"]').fill(testNoteTitle);
    await page.locator('[data-testid="editor-content"] > div').fill(testNoteContent);

    await page.locator('[data-testid="rich-text-bold-button"]').click();

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations.length).toEqual(0);
  });
});
