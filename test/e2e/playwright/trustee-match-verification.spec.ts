import { expect, Page } from '@playwright/test';
import { test } from './fixture/urlQueryString';
import { TrusteeMatchVerificationListItem } from '../../../common/src/cams/trustee-match-verification';
import { logout } from './login/login-helpers';

const timeoutOption = { timeout: 60000 };

// Seeded identity tasks (test/e2e/fixtures/mongo-fixture.json). Each source record is name-only,
// so the name is the one comparison the pipeline could make, and it differs for every candidate.
const AMBIGUOUS_TASK_ID = 'e2e-trustee-match-verification-pending-1'; // Taylor and Tyler Multimatch
const ADDRESS_PHONE_TASK_ID = 'e2e-trustee-match-verification-pending-2'; // Jordan Imperfectmach, weak name
const NO_CANDIDATES_TASK_ID = 'e2e-trustee-match-verification-pending-3';
const STATE_DIFFERS_TASK_ID = 'e2e-trustee-match-verification-pending-4'; // Morgan Stateline, exact name
const APPROVED_TASK_ID = 'e2e-trustee-match-verification-approved';
const CASELESS_TASK_ID = 'e2e-trustee-match-verification-caseless'; // Casey and Carter Caselessmatch, no caseId/courtId
// Q Lakeshore, caseless, carries an ACMS professional id. The only task approved here, so it is
// left out of every other test.
const ACMS_LINK_TASK_ID = 'e2e-trustee-match-verification-acms-link';
// J Nocasematch, ACMS-sourced and ambiguous (Jamie and Jesse Nocasematch), caseless as the ACMS
// sync writes it. Approved by its own test, so it is left out of every other test.
const ACMS_AMBIGUOUS_TASK_ID = 'e2e-trustee-match-verification-acms-ambiguous';

async function expandTask(page: Page, id: string) {
  await page.getByTestId(`accordion-button-order-list-${id}`).click();
  const content = page.getByTestId(`accordion-content-order-list-${id}`);
  await expect(content).toBeVisible(timeoutOption);
  return content;
}

test.describe('Trustee Identity Verification', () => {
  let verificationItems: TrusteeMatchVerificationListItem[];

  test.beforeEach(async ({ page }) => {
    // Register response listener before navigation so it isn't missed
    const verificationResponsePromise = page.waitForResponse(
      async (response) =>
        response.url().includes('api/trustee-match-verification') && response.ok(),
      timeoutOption,
    );
    await page.goto('/data-verification');
    await expect(page.getByTestId('header-data-verification-link')).toBeVisible(timeoutOption);

    // Wait for the verification list to load before interacting with filters
    const verificationResponse = await verificationResponsePromise;

    // Deselect Transfer and Consolidation, leaving only Trustee Identity selected
    await page.locator('#task-type-filter-expand').click(timeoutOption);
    await page.locator('[id="option-transfer"]').click(timeoutOption);
    await page.locator('[id="option-consolidation"]').click(timeoutOption);
    await expect(page.getByTestId('accordion-group')).toBeVisible(timeoutOption);
    verificationItems = (await verificationResponse.json()).data;
    expect(verificationItems).not.toBeFalsy();
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('lists the seeded pending identity tasks by source trustee name', async ({ page }) => {
    const pending = verificationItems.filter(
      (v) => v.taskType === 'trustee-match' && v.status === 'pending',
    );
    expect(pending.length).toBeGreaterThan(0);

    for (const item of pending) {
      const heading = page.getByTestId(`accordion-heading-${item.id}`);
      await expect(heading).toBeVisible(timeoutOption);
      await expect(heading).toContainText(item.sourceTrustee.fullName);
    }
  });

  test('explains why the task needs review', async ({ page }) => {
    const content = await expandTask(page, AMBIGUOUS_TASK_ID);

    await expect(content.locator('.problem-statement')).toContainText(
      'Trustee information sent to CAMS matches multiple trustees in CAMS.',
      timeoutOption,
    );
    await expect(content).not.toContainText('Sent By Court');
  });

  test('shows the information received, then each candidate as a row in rank order', async ({
    page,
  }) => {
    const content = await expandTask(page, AMBIGUOUS_TASK_ID);

    const received = content.getByTestId('trustee-information-received-table');
    await expect(received).toBeVisible(timeoutOption);
    await expect(received.getByRole('columnheader')).toHaveText([
      'Name',
      'Address',
      'Phone',
      'Email',
    ]);
    await expect(received.locator('tbody tr')).toHaveCount(1);

    const table = content.getByTestId('trustee-comparison-table');
    await expect(table).toBeVisible(timeoutOption);
    await expect(table.getByRole('columnheader')).toHaveText([
      'Name',
      'Address',
      'Phone',
      'Email',
      'Action',
    ]);
    await expect(table.locator('tbody').getByRole('rowheader')).toHaveText([
      'Taylor Multimatch',
      'Tyler Multimatch',
    ]);

    // "T" is only an initial, and neither candidate shares the source's street or phone, so each
    // row marks its name, address and phone; no email was sent, so Email carries no marker.
    await expect(table.getByLabel('Name differs from the source record')).toHaveCount(2);
    await expect(table.getByLabel('Address differs from the source record')).toHaveCount(2);
    await expect(table.getByLabel('Phone differs from the source record')).toHaveCount(2);
    await expect(table.getByLabel(/differs from the source record/)).toHaveCount(6);
  });

  test('previews the chosen candidate in Confirm Trustee Match', async ({ page }) => {
    const content = await expandTask(page, AMBIGUOUS_TASK_ID);

    await content.getByTestId('approve-candidate-seed-trustee-match-multi-b').click();

    const modal = page.getByTestId(`modal-content-trustee-confirmation-modal-${AMBIGUOUS_TASK_ID}`);
    await expect(modal).toBeVisible(timeoutOption);
    await expect(modal.getByRole('heading', { name: 'Confirm Trustee Match' })).toBeVisible();
    await expect(modal).toContainText('Is this the same trustee as the information sent to CAMS?');
    await expect(modal.getByRole('heading', { name: 'Information Sent to CAMS' })).toBeVisible();

    // The same stored differences the table marks for this candidate: name, phone and street.
    const selected = modal.getByTestId('confirm-match-selected');
    await expect(selected.getByRole('heading', { name: 'Selected CAMS Trustee' })).toBeVisible();
    await expect(selected.getByRole('link', { name: /Tyler Multimatch/ })).toBeVisible();
    await expect(selected.getByLabel('Name differs from the source record')).toBeVisible();
    await expect(selected.getByLabel('Phone differs from the source record')).toBeVisible();
    await expect(selected.getByLabel('Street differs from the source record')).toBeVisible();
    await expect(selected.getByLabel(/differs from the source record/)).toHaveCount(3);
    await expect(modal.getByTestId('confirm-match-source').getByRole('img')).toHaveCount(0);

    await expect(modal).toContainText('1 case will be assigned to Tyler Multimatch.');

    // Approval is not submitted here: see the CAMS-956 deferred specs in the Slice 4 prompts.
    await page.locator(`#trustee-confirmation-modal-${AMBIGUOUS_TASK_ID}-cancel-button`).click();
    await expect(modal).toBeHidden(timeoutOption);
  });

  test('shows only the source record and trustee search when there are no candidates', async ({
    page,
  }) => {
    const content = await expandTask(page, NO_CANDIDATES_TASK_ID);

    await expect(content.locator('.problem-statement')).toContainText(
      'Trustee information sent to CAMS does not match any trustee in CAMS.',
      timeoutOption,
    );
    await expect(
      content.getByTestId('trustee-information-received-table').getByRole('columnheader'),
    ).toHaveText(['Name', 'Address', 'Phone', 'Email']);
    await expect(content.getByTestId('trustee-comparison-table')).toHaveCount(0);
    await expect(content).toContainText('There are no suggested matches in CAMS.');
    await expect(content.getByRole('button', { name: /Search for a trustee/ })).toBeVisible();
  });

  test('links the affected case in a new tab', async ({ page }) => {
    const content = await expandTask(page, AMBIGUOUS_TASK_ID);

    const caseLink = content.locator('.problem-statement a.new-tab-link').first();
    await expect(caseLink).toBeVisible(timeoutOption);
    await expect(caseLink).toHaveAttribute('target', '_blank');
    await expect(caseLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('shows the resolved statement for an approved task', async ({ page }) => {
    const content = await expandTask(page, APPROVED_TASK_ID);

    const resolvedStatement = content.getByTestId('resolved-statement');
    await expect(resolvedStatement).toBeVisible(timeoutOption);
    await expect(resolvedStatement).toContainText('was appointed to case');
  });

  test('shows the right "Why CAMS needs you" sentence for each kind of pending task', async ({
    page,
  }) => {
    await expect(await expandTask(page, NO_CANDIDATES_TASK_ID)).toContainText(
      'Trustee information sent to CAMS does not match any trustee in CAMS. Affects 1 case:',
    );
    await expect(await expandTask(page, AMBIGUOUS_TASK_ID)).toContainText(
      'Trustee information sent to CAMS matches multiple trustees in CAMS. Affects 1 case:',
    );
    await expect(await expandTask(page, STATE_DIFFERS_TASK_ID)).toContainText(
      'Trustee state sent to CAMS does not exactly match a trustee in CAMS. Affects 1 case:',
    );
    await expect(await expandTask(page, ADDRESS_PHONE_TASK_ID)).toContainText(
      'Trustee name, address and phone sent to CAMS do not exactly match a trustee in CAMS. Affects 1 case:',
    );
  });

  test('shows "No cases yet" for a caseless task, and the modal\'s zero-case sentence', async ({
    page,
  }) => {
    const content = await expandTask(page, CASELESS_TASK_ID);

    await expect(content.locator('.problem-statement')).toContainText(
      'No cases yet. Cases attach as appointments sync.',
      timeoutOption,
    );
    await expect(content.locator('.problem-statement a.new-tab-link')).toHaveCount(0);

    await content.getByTestId('approve-candidate-seed-trustee-match-caseless-b').click();

    const modal = page.getByTestId(`modal-content-trustee-confirmation-modal-${CASELESS_TASK_ID}`);
    await expect(modal).toBeVisible(timeoutOption);
    await expect(modal).toContainText(
      'No cases are affected yet. Future cases sent with this information will be matched to Carter Caselessmatch automatically.',
    );

    // Approval is not submitted here: see the CAMS-956 deferred specs in the Slice 4 prompts.
    await page.locator(`#trustee-confirmation-modal-${CASELESS_TASK_ID}-cancel-button`).click();
    await expect(modal).toBeHidden(timeoutOption);
  });

  test('approves a task that carries an ACMS professional id', async ({ page }) => {
    const content = await expandTask(page, ACMS_LINK_TASK_ID);

    await content.getByTestId('approve-candidate-seed-trustee-match-lakeshore').click();
    const modal = page.getByTestId(`modal-content-trustee-confirmation-modal-${ACMS_LINK_TASK_ID}`);
    await expect(modal).toBeVisible(timeoutOption);

    const approval = page.waitForResponse(
      (response) =>
        response.url().includes(`api/trustee-match-verification/${ACMS_LINK_TASK_ID}`) &&
        response.request().method() === 'PATCH',
      timeoutOption,
    );
    await page.locator(`#trustee-confirmation-modal-${ACMS_LINK_TASK_ID}-submit-button`).click();
    expect((await approval).ok()).toBe(true);

    await expect(page.getByTestId('alert-message-data-verification-alert')).toContainText(
      'Trustee Quinn Lakeshore appointed. No cases affected.',
      timeoutOption,
    );
    await expect(content.getByTestId('resolved-statement')).toContainText(
      'Trustee Quinn Lakeshore was approved. No cases affected.',
      timeoutOption,
    );
  });

  test('approves a caseless ambiguous task from the ACMS professional-id sync', async ({
    page,
  }) => {
    const content = await expandTask(page, ACMS_AMBIGUOUS_TASK_ID);

    await expect(content.locator('.problem-statement')).toContainText(
      'Trustee information sent to CAMS matches multiple trustees in CAMS. No cases yet. Cases attach as appointments sync.',
      timeoutOption,
    );
    await expect(content.locator('.problem-statement a.new-tab-link')).toHaveCount(0);
    await expect(
      content.getByTestId('trustee-comparison-table').locator('tbody').getByRole('rowheader'),
    ).toHaveText(['Jamie Nocasematch', 'Jesse Nocasematch']);

    await content.getByTestId('approve-candidate-seed-trustee-match-nocases-a').click();
    const modal = page.getByTestId(
      `modal-content-trustee-confirmation-modal-${ACMS_AMBIGUOUS_TASK_ID}`,
    );
    await expect(modal).toBeVisible(timeoutOption);
    await expect(modal).toContainText(
      'No cases are affected yet. Future cases sent with this information will be matched to Jamie Nocasematch automatically.',
    );

    const approval = page.waitForResponse(
      (response) =>
        response.url().includes(`api/trustee-match-verification/${ACMS_AMBIGUOUS_TASK_ID}`) &&
        response.request().method() === 'PATCH',
      timeoutOption,
    );
    await page
      .locator(`#trustee-confirmation-modal-${ACMS_AMBIGUOUS_TASK_ID}-submit-button`)
      .click();
    expect((await approval).ok()).toBe(true);

    await expect(page.getByTestId('alert-message-data-verification-alert')).toContainText(
      'Trustee Jamie Nocasematch appointed. No cases affected.',
      timeoutOption,
    );
    await expect(content.getByTestId('resolved-statement')).toContainText(
      'Trustee Jamie Nocasematch was approved. No cases affected.',
      timeoutOption,
    );
  });
});
