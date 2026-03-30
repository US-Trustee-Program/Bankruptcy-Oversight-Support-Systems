import { expect } from '@playwright/test';
import { test } from './fixture/urlQueryString';
import { TrusteeMatchVerification } from '../../../common/src/cams/trustee-match-verification';
import { logout } from './login/login-helpers';

const timeoutOption = { timeout: 30000 };

test.describe('Trustee Match Verification', () => {
  let verificationItems: TrusteeMatchVerification[];
  let verificationResponsePromise;

  test.beforeEach(async ({ page }) => {
    verificationResponsePromise = page.waitForResponse(
      async (response) =>
        response.url().includes('api/trustee-match-verification') && response.ok(),
      timeoutOption,
    );
    await page.goto('/data-verification');
    await expect(page.getByTestId('header-data-verification-link')).toBeVisible(timeoutOption);
    await expect(page.getByTestId('accordion-group')).toBeVisible(timeoutOption);

    const verificationResponse = await verificationResponsePromise;
    verificationItems = (await verificationResponse.json()).data;
    expect(verificationItems).not.toBeFalsy();
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should display trustee match verification items in the accordion list', async ({
    page,
  }) => {
    const trusteeItems = verificationItems.filter((v) => v.orderType === 'trustee-match');
    expect(trusteeItems.length).toBeGreaterThan(0);

    for (const item of trusteeItems.slice(0, 3)) {
      await expect(page.getByTestId(`accordion-heading-${item.id}`)).toBeVisible(timeoutOption);
    }
  });

  test('should expand a pending trustee match verification accordion and show content', async ({
    page,
  }) => {
    const pendingItem = verificationItems.find(
      (v) => v.orderType === 'trustee-match' && v.status === 'pending',
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
      (v) => v.orderType === 'trustee-match' && v.status === 'pending',
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
      (v) => v.orderType === 'trustee-match' && v.status === 'approved',
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
      (v) => v.orderType === 'trustee-match' && v.status === 'rejected',
    );
    expect(rejectedItem).not.toBeFalsy();

    await page.getByTestId(`accordion-button-order-list-${rejectedItem!.id}`).click();

    const content = page.getByTestId(`accordion-content-order-list-${rejectedItem!.id}`);
    await expect(content).toBeVisible(timeoutOption);
    await expect(content.getByTestId('reject-button')).not.toBeAttached();
  });
});
