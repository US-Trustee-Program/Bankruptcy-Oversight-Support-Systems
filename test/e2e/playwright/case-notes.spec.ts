import { KNOWN_GOOD_TRANSFER_TO_CASE_ID } from '../scripts/data-generation-utils';
import { expect } from '@playwright/test';
import { test } from './fixture/urlQueryString';
import { logout } from './login/login-helpers';

test.describe.only('Consolidation Orders', () => {
  //   let caseNoteResponseBody: CaseNote[];
  //   let getCaseNoteNoteResponse;
  //   let caseNoteArchivalRequest;
  //   let caseNoteArchivalResponse;
  let caseNoteTitleInput;
  let caseNoteContentInput;
  let submitCaseNoteButton;

  test.beforeEach(async ({ page }) => {
    // Navigate to Case Details and capture network responses

    await page.goto(`/case-detail/${KNOWN_GOOD_TRANSFER_TO_CASE_ID}/notes`);

    // getCaseNoteNoteResponse = page.waitForResponse(
    //   async (response) =>
    //     response.url().includes(`api/notes/${KNOWN_GOOD_TRANSFER_TO_CASE_ID}`) && response.ok(),
    //   timeoutOption,
    // );

    // const caseNoteResponse = await getCaseNoteNoteResponse;
    // caseNoteResponseBody = (await caseNoteResponse.json()).data;
    // expect(caseNoteResponseBody).toEqual([]);
    caseNoteTitleInput = page.getByTestId('case-note-title-input');
    caseNoteContentInput = page.getByTestId('textarea-note-content');
    submitCaseNoteButton = page.getByTestId('button-submit-case-note');
    await expect(caseNoteTitleInput).toBeVisible();
    await expect(caseNoteContentInput).toBeVisible();
    await expect(submitCaseNoteButton).toBeDisabled();
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should crete a case note for a case, and be able to remove that case note', async ({
    page,
  }) => {
    const testNoteTitle = 'Test Note Title';
    let caseNoteHeader;
    let openRemovalModalButton;
    let confirmButton;

    caseNoteTitleInput.fill(testNoteTitle);
    caseNoteContentInput.fill('Test Note Content for E2E purposes');
    submitCaseNoteButton = page.getByTestId('button-submit-case-note');
    expect(submitCaseNoteButton).toBeEnabled();
    submitCaseNoteButton.click();

    caseNoteHeader = page.getByTestId('case-note-0-header');
    await expect(caseNoteHeader).toBeVisible();
    await expect(caseNoteHeader).toHaveText(testNoteTitle);
    openRemovalModalButton = page.getByTestId('open-modal-button-0');
    await expect(openRemovalModalButton).toBeVisible();
    openRemovalModalButton.click();
    confirmButton = page.getByTestId('button-archive-modal-submit-button');
    await expect(confirmButton).toBeVisible();
    confirmButton.click();
    confirmButton = page.getByTestId('button-archive-modal-submit-button');
    await expect(confirmButton).not.toBeVisible();
    caseNoteHeader = page.getByTestId('case-note-0-header');
    await expect(caseNoteHeader).not.toBeVisible();
    openRemovalModalButton = page.getByTestId('open-modal-button-0');
    await expect(openRemovalModalButton).toBeVisible();

    // caseNoteArchivalRequestPromise = page.waitForEvent('requestfinished', {
    //   predicate: (e) => e.url().includes('api/courts'),
    //   timeout: 30000,
    // });
    // await caseNoteArchivalRequestPromise;
  });
});
