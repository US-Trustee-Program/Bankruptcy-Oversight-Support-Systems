import { KNOWN_GOOD_TRANSFER_TO_CASE_ID } from '../scripts/data-generation-utils';
import { expect } from '@playwright/test';
import { test } from './fixture/urlQueryString';
import { logout } from './login/login-helpers';
test.describe('Case Notes', () => {
  test.describe.configure({ retries: 0, mode: 'serial' });
  let addCaseNoteButton;
  let noteNotesAlert;
  test.beforeEach(async ({ page }) => {
    await page.goto(`/case-detail/${KNOWN_GOOD_TRANSFER_TO_CASE_ID}/notes`);

    addCaseNoteButton = page.getByTestId('open-modal-button_case-note-add-button');
    await expect(addCaseNoteButton).toBeVisible();
    noteNotesAlert = page.getByTestId('alert-message');
    await expect(noteNotesAlert).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test.only('should create a case note for a case, edit that case note, and be able to remove that case note', async ({
    page,
  }) => {
    const testNoteTitle = 'Test Note Title';
    const testNoteContent = 'Test Note Content for E2E purposes';
    const noteTitleEdit = 'Edited Note Title';
    const noteContentEdit = 'Edited Note Content for E2E purposes';
    let caseNoteHeader;
    //Open Add Note modal to create a new note and submit
    await page.locator('[data-testid="open-modal-button_case-note-add-button"]').click();
    await expect(page.locator('[data-testid="modal-content-case-note-form"]')).toBeVisible();
    await page.locator('[data-testid="case-note-title-input"]').fill(testNoteTitle);
    await page.locator('[data-testid="textarea-note-content"]').fill(testNoteContent);
    await expect(page.locator('[data-testid="button-case-note-form-submit-button"]')).toBeVisible();
    await page.locator('[data-testid="button-case-note-form-submit-button"]').click();
    await expect(page.locator('[data-testid="modal-content-case-note-form"]')).not.toBeVisible();

    //Ensure Newly created Note is there
    caseNoteHeader = page.getByTestId('case-note-0-header');
    await expect(caseNoteHeader).toBeVisible();
    await expect(caseNoteHeader).toHaveText(testNoteTitle);

    //Edit newly created Case Note and ensure previous values are populated on first load
    await expect(
      page.locator('[data-testid="open-modal-button_case-note-edit-button_0"]'),
    ).toBeVisible();
    await page.locator('[data-testid="open-modal-button_case-note-edit-button_0"]').click();

    await expect(page.locator('[data-testid="case-note-title-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="textarea-note-content"]')).toBeVisible();

    await page.locator('[data-testid="case-note-title-input"]').clear();
    await page.locator('[data-testid="case-note-title-input"]').fill(noteTitleEdit);
    await page.locator('[data-testid="textarea-note-content"]').clear();
    await page.locator('[data-testid="textarea-note-content"]').fill(noteContentEdit);

    await expect(page.locator('[data-testid="button-case-note-form-submit-button"]')).toBeEnabled();
    await page.locator('[data-testid="button-case-note-form-submit-button"]').click();

    caseNoteHeader = page.getByTestId('case-note-0-header');
    await expect(caseNoteHeader).toBeVisible();
    await expect(caseNoteHeader).toHaveText(noteTitleEdit);

    await page.goto(`/case-detail/${KNOWN_GOOD_TRANSFER_TO_CASE_ID}/notes`);

    //Remove Newly created note edit
    await expect(
      page.locator('[data-testid="open-modal-button_case-note-remove-button_0"]'),
    ).toBeVisible();
    await page.locator('[data-testid="open-modal-button_case-note-remove-button_0"]').click();
    await expect(
      page.locator('[data-testid="button-remove-note-modal-submit-button"]'),
    ).toBeVisible();
    await page.locator('[data-testid="button-remove-note-modal-submit-button"]').click();
    await page.goto(`/case-detail/${KNOWN_GOOD_TRANSFER_TO_CASE_ID}/notes`);

    await expect(page.locator('[data-testid="searchable-case-notes"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="empty-notes-test-id"]')).toBeVisible();
  });
});
