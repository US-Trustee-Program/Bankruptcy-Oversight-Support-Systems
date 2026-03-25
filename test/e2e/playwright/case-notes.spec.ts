import DataGenerationUtils from '../../../backend/function-apps/dataflows/e2e/data-generation-utils';
import { expect } from '@playwright/test';
import { test } from './fixture/urlQueryString';

const timeoutOption = { timeout: 60000 };

test.describe('Case Notes', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });

  let addCaseNoteButton;
  let noteNotesAlert;

  test.beforeEach(async ({ page }) => {
    await page.goto(`/case-detail/${DataGenerationUtils.KNOWN_GOOD_TRANSFER_TO_CASE_ID}/notes`);

    addCaseNoteButton = page.getByTestId('open-modal-button_note-add-button');
    await expect(addCaseNoteButton).toBeVisible(timeoutOption);
    noteNotesAlert = page.getByTestId('alert-message');
    await expect(noteNotesAlert).toBeVisible(timeoutOption);
  });

  test('should create a case note for a case, edit that case note, and be able to remove that case note', async ({
    page,
  }) => {
    const testNoteTitle = 'Test Note Title';
    const testNoteContent = 'Test Note Content for E2E purposes';
    const noteTitleEdit = 'Edited Note Title';
    const noteContentEdit = 'Edited Note Content for E2E purposes';
    let caseNoteHeader;

    //Open Add Note modal to create a new note and submit
    await page.locator('[data-testid="open-modal-button_note-add-button"]').click();
    await expect(page.locator('[data-testid="modal-content-note-modal"]')).toBeVisible();

    await page.locator('[data-testid="note-title-input"]').fill(testNoteTitle);
    await page.locator('[data-testid="editor-content"] > div').fill(testNoteContent);
    await expect(page.locator('[data-testid="button-note-modal-submit-button"]')).toBeVisible();
    await page.locator('[data-testid="button-note-modal-submit-button"]').click();
    await expect(page.locator('[data-testid="modal-content-note-modal"]')).not.toBeVisible();

    //Ensure Newly created Note is there
    caseNoteHeader = page.getByTestId('note-item-0-header');
    await expect(caseNoteHeader).toBeVisible();
    await expect(caseNoteHeader).toHaveText(testNoteTitle);

    //Edit newly created Case Note and ensure previous values are populated on first load
    await expect(
      page.locator('[data-testid="open-modal-button_note-item-edit-button_0"]'),
    ).toBeVisible();
    await page.locator('[data-testid="open-modal-button_note-item-edit-button_0"]').click();

    await expect(page.locator('[data-testid="note-title-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="editor-content"] > div')).toBeVisible();

    await page.locator('[data-testid="note-title-input"]').clear();
    await page.locator('[data-testid="note-title-input"]').fill(noteTitleEdit);
    await page.locator('[data-testid="editor-content"] > div').clear();
    await page.locator('[data-testid="editor-content"] > div').fill(noteContentEdit);

    await expect(page.locator('[data-testid="button-note-modal-submit-button"]')).toBeEnabled();
    await page.locator('[data-testid="button-note-modal-submit-button"]').click();
    await expect(page.locator('[data-testid="modal-content-note-modal"]')).not.toBeVisible();
    caseNoteHeader = page.getByTestId('note-item-0-header');
    await expect(caseNoteHeader).toBeVisible();
    await expect(caseNoteHeader).toHaveText(noteTitleEdit);

    //Remove Newly created note edit
    await expect(
      page.locator('[data-testid="open-modal-button_note-item-remove-button_0"]'),
    ).toBeVisible();
    await page.locator('[data-testid="open-modal-button_note-item-remove-button_0"]').click();
    await expect(
      page.locator('[data-testid="button-note-remove-modal-submit-button"]'),
    ).toBeVisible();
    await page.locator('[data-testid="button-note-remove-modal-submit-button"]').click();

    await expect(page.locator('[data-testid="searchable-notes"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="empty-notes"]')).toBeVisible();
  });
});
