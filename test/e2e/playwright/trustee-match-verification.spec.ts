import { expect } from '@playwright/test';
import { test } from './fixture/urlQueryString';
import { TrusteeMatchVerification } from '../../../common/src/cams/trustee-match-verification';
import { TrusteeAppointmentSyncErrorCode } from '../../../common/src/cams/dataflow-events';
import { logout } from './login/login-helpers';

const timeoutOption = { timeout: 60000 };

test.describe('Trustee Match Verification', () => {
  let verificationItems: TrusteeMatchVerification[];
  let verificationResponsePromise;

  test.beforeEach(async ({ page }) => {
    // Register response listener before navigation so it isn't missed
    verificationResponsePromise = page.waitForResponse(
      async (response) =>
        response.url().includes('api/trustee-match-verification') && response.ok(),
      timeoutOption,
    );
    await page.goto('/data-verification');
    await expect(page.getByTestId('header-data-verification-link')).toBeVisible(timeoutOption);

    // Wait for the verification list to load before interacting with filters
    const verificationResponse = await verificationResponsePromise;

    // Deselect Transfer and Consolidation, leaving only Trustee Mismatch selected
    await page.locator('#task-type-filter-expand').click(timeoutOption);
    await page.getByTestId('task-type-filter-option-item-0').click(timeoutOption);
    await page.getByTestId('task-type-filter-option-item-1').click(timeoutOption);
    await expect(page.getByTestId('accordion-group')).toBeVisible(timeoutOption);
    verificationItems = (await verificationResponse.json()).data;
    expect(verificationItems).not.toBeFalsy();
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should display trustee match verification items in the accordion list', async ({
    page,
  }) => {
    const trusteeItems = verificationItems.filter((v) => v.taskType === 'trustee-match');
    expect(trusteeItems.length).toBeGreaterThan(0);

    for (const item of trusteeItems.slice(0, 3)) {
      await expect(page.getByTestId(`accordion-heading-${item.id}`)).toBeVisible(timeoutOption);
    }
  });

  test('should expand a pending trustee match verification accordion and show content', async ({
    page,
  }) => {
    const pendingItem = verificationItems.find(
      (v) => v.taskType === 'trustee-match' && v.status === 'pending',
    );
    expect(pendingItem).not.toBeFalsy();

    await page.getByTestId(`accordion-button-order-list-${pendingItem!.id}`).click();

    const content = page.getByTestId(`accordion-content-order-list-${pendingItem!.id}`);
    await expect(content).toBeVisible(timeoutOption);
    expect(content).toBeTruthy();
  });

  test('should show case link in expanded trustee match verification accordion', async ({
    page,
  }) => {
    const pendingItem = verificationItems.find(
      (v) => v.taskType === 'trustee-match' && v.status === 'pending',
    );
    expect(pendingItem).not.toBeFalsy();

    await page.getByTestId(`accordion-button-order-list-${pendingItem!.id}`).click();

    const content = page.getByTestId(`accordion-content-order-list-${pendingItem!.id}`);
    await expect(content).toBeVisible(timeoutOption);

    const caseLink = content.locator('a.new-tab-link').first();
    await expect(caseLink).toBeVisible(timeoutOption);
    await expect(caseLink).toHaveAttribute('target', '_blank');
    await expect(caseLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('should show resolved statement for an approved trustee match verification', async ({
    page,
  }) => {
    const approvedItem = verificationItems.find(
      (v) => v.taskType === 'trustee-match' && v.status === 'approved',
    );
    expect(approvedItem).not.toBeFalsy();

    await page.getByTestId(`accordion-button-order-list-${approvedItem!.id}`).click();

    const resolvedStatement = page.getByTestId('resolved-statement');
    await expect(resolvedStatement).toBeVisible(timeoutOption);
    await expect(resolvedStatement).toContainText('was appointed to case');
  });

  test('should show read-only candidate table for a rejected trustee match verification', async ({
    page,
  }) => {
    const rejectedItem = verificationItems.find(
      (v) => v.taskType === 'trustee-match' && v.status === 'rejected',
    );
    expect(rejectedItem).not.toBeFalsy();

    await page.getByTestId(`accordion-button-order-list-${rejectedItem!.id}`).click();

    const content = page.getByTestId(`accordion-content-order-list-${rejectedItem!.id}`);
    await expect(content).toBeVisible(timeoutOption);
    await expect(content.getByTestId('reject-button')).not.toBeAttached();
  });

  test('should show distinct problem statement for inactive match verification', async ({
    page,
  }) => {
    const inactiveItem = verificationItems.find(
      (v) =>
        v.taskType === 'trustee-match' &&
        v.mismatchReason === TrusteeAppointmentSyncErrorCode.PerfectMatchInactiveStatus,
    );
    expect(inactiveItem).not.toBeFalsy();

    await page.getByTestId(`accordion-button-order-list-${inactiveItem!.id}`).click();

    const content = page.getByTestId(`accordion-content-order-list-${inactiveItem!.id}`);
    await expect(content).toBeVisible(timeoutOption);
    // The tail of this sentence is dynamic (lists whichever fields mismatch once candidate
    // detail loads), so only assert the always-present, inactive-specific prefix.
    await expect(content).toContainText('Trustee is inactive in CAMS');
  });

  test("should compose the leading sentence from the candidate's real mismatched fields", async ({
    page,
  }) => {
    // e2e-trustee-match-verification-inactive's seeded candidate has no real DXTR name/address/
    // phone/email data to match against (see mongo-fixture.json), so every one of those fields
    // is a genuine mismatch - this pins the exact composed sentence against that known data,
    // guarding against the CandidateScore-data-quality bug this fixture once had (unbacked
    // addressScore, missing nameScore/phoneScore/emailScore) silently regressing.
    const inactiveItem = verificationItems.find(
      (v) =>
        v.taskType === 'trustee-match' &&
        v.mismatchReason === TrusteeAppointmentSyncErrorCode.PerfectMatchInactiveStatus,
    );
    expect(inactiveItem).not.toBeFalsy();

    await page.getByTestId(`accordion-button-order-list-${inactiveItem!.id}`).click();

    const content = page.getByTestId(`accordion-content-order-list-${inactiveItem!.id}`);
    await expect(content).toBeVisible(timeoutOption);
    await expect(content).toContainText(
      'Trustee is inactive in CAMS and name, address, phone, and email sent from the court do not match a CAMS Trustee for case:',
    );
  });

  test('should show inactive trustee task type label for inactive match verification', async ({
    page,
  }) => {
    const inactiveItem = verificationItems.find(
      (v) =>
        v.taskType === 'trustee-match' &&
        v.mismatchReason === TrusteeAppointmentSyncErrorCode.PerfectMatchInactiveStatus,
    );
    expect(inactiveItem).not.toBeFalsy();

    const heading = page.getByTestId(`accordion-heading-${inactiveItem!.id}`);
    await expect(heading).toBeVisible(timeoutOption);
    await expect(heading).toContainText('Inactive Trustee');
  });
});
