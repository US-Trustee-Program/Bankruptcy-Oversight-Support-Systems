import { expect, Page } from '@playwright/test';
import { test } from './fixture/urlQueryString';
import { TrusteeMatchVerificationListItem } from '../../../common/src/cams/trustee-match-verification';
import { logout } from './login/login-helpers';

const timeoutOption = { timeout: 60000 };

// Seeded identity tasks (test/e2e/fixtures/mongo-fixture.json). Each source record is name-only,
// so the name is the one comparison the pipeline could make, and it differs for every candidate.
const AMBIGUOUS_TASK_ID = 'e2e-trustee-match-verification-pending-1'; // candidates 1 and 2
const NO_CANDIDATES_TASK_ID = 'e2e-trustee-match-verification-pending-3';
const APPROVED_TASK_ID = 'e2e-trustee-match-verification-approved';

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
      await expect(heading).toContainText(item.dxtrTrustee.fullName);
    }
  });

  test('shows the reason, DXTR source badge and case count in the expanded header', async ({
    page,
  }) => {
    const content = await expandTask(page, AMBIGUOUS_TASK_ID);

    const header = content.getByTestId('identity-task-header');
    await expect(header.getByTestId('identity-task-reason')).toHaveText('Multiple matches');
    await expect(header.locator('.usa-tag')).toHaveText('DXTR');
    await expect(header.getByTestId('identity-task-case-count')).toHaveText('1 case');
    await expect(content).not.toContainText('Sent By Court');
  });

  test('compares the source record with each candidate in rank order', async ({ page }) => {
    const content = await expandTask(page, AMBIGUOUS_TASK_ID);

    const table = content.getByTestId('trustee-comparison-table');
    await expect(table).toBeVisible(timeoutOption);
    await expect(table.getByRole('columnheader')).toHaveText([
      'Field',
      'Source record (DXTR)',
      'E2E Trustee 1',
      'E2E Trustee 2',
    ]);
    // Body rows only: a pending task's footer adds a screen-reader-only 'Action' row header.
    await expect(table.locator('tbody').getByRole('rowheader')).toHaveText([
      'Name',
      'Phone',
      'Street',
      'City',
      'State',
      'Zip',
      'Email',
      'Found by',
    ]);

    // Only the name was compared; both candidates' names differ from the source record.
    const nameRow = table
      .getByRole('row')
      .filter({ has: page.getByRole('rowheader', { name: 'Name' }) });
    await expect(nameRow.getByLabel('Name differs from the source record')).toHaveCount(2);
    await expect(table.getByLabel(/differs from the source record/)).toHaveCount(2);
  });

  test('opens the confirmation modal for the chosen candidate', async ({ page }) => {
    const content = await expandTask(page, AMBIGUOUS_TASK_ID);

    await content.getByTestId('approve-candidate-e2e-trustee-candidate-2').click();

    const modal = page.getByTestId(`modal-content-trustee-confirmation-modal-${AMBIGUOUS_TASK_ID}`);
    await expect(modal).toBeVisible(timeoutOption);
    await expect(modal).toContainText('E2E Trustee 2');
    await page.locator(`#trustee-confirmation-modal-${AMBIGUOUS_TASK_ID}-cancel-button`).click();
    await expect(modal).toBeHidden(timeoutOption);
  });

  test('shows only the source record and trustee search when there are no candidates', async ({
    page,
  }) => {
    const content = await expandTask(page, NO_CANDIDATES_TASK_ID);

    await expect(content.getByTestId('identity-task-reason')).toHaveText('No match');
    await expect(
      content.getByTestId('trustee-comparison-table').getByRole('columnheader'),
    ).toHaveText(['Field', 'Source record (DXTR)']);
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
});
