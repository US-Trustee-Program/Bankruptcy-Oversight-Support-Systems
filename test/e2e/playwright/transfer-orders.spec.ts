import { expect, Request } from '@playwright/test';
import { test } from './fixture/urlQueryString';
import { logout } from './login/login-helpers';

interface Order {
  id: string;
  caseId: string;
  caseTitle: string;
  orderType: string;
  status: string;
  docketSuggestedCaseNumber: string;
}

test.describe('Transfer Orders', () => {
  let orderResponseBody: Array<Order>;
  let ordersRequestPromise: Promise<Request>;
  let officesRequestPromise: Promise<Request>;
  let orderResponsePromise;
  test.beforeEach(async ({ page }) => {
    // Navigate to Data Verification and capture network responses
    orderResponsePromise = page.waitForResponse(
      async (response) => response.url().includes('api/order') && response.ok(),
    );
    await page.goto('/data-verification');
    ordersRequestPromise = page.waitForEvent('requestfinished', {
      predicate: (e) => e.url().includes('api/orders'),
    });
    officesRequestPromise = page.waitForEvent('requestfinished', {
      predicate: (e) => e.url().includes('api/courts'),
    });
    await expect(page.getByTestId('header-data-verification-link')).toBeVisible();
    await expect(page.getByTestId('accordion-group')).toBeVisible();

    const orderResponse = await orderResponsePromise;
    orderResponseBody = (await orderResponse.json()).data;

    expect(orderResponseBody).not.toBeFalsy();
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('test pending transfer order form', async ({ page }) => {
    await expect(page.getByTestId('accordion-group')).toBeVisible();
    // get pending transfer order id
    const pendingTransferOrder: Order = orderResponseBody.find(
      (o) => o.orderType === 'transfer' && o.status === 'pending',
    );
    expect(pendingTransferOrder).not.toBeFalsy();
    const orderId = pendingTransferOrder.id;

    // open accordion by order id
    await page.getByTestId(`accordion-button-order-list-${orderId}`).click();

    // Wait on the offices to come back from API
    await officesRequestPromise;
    // Wait for the transfer orders.
    const request = await ordersRequestPromise;
    const response = await request.response();
    const ordersResponse = (await response.json()).data;
    const pendingTransfers = ordersResponse.filter(
      (o) => o.orderType === 'transfer' && o.status === 'pending',
    );
    const firstOrder = pendingTransfers[0] ?? null;
    const firstOrderId = firstOrder.id;

    // Start testing the UI
    await page.getByTestId('button-radio-case-not-listed-radio-button-click-target').click();
    await page.locator(`#court-selection-${orderId}-expand`).click();
    const court = 'manhattan';
    await page.locator(`#court-selection-${orderId}-combo-box-input`).fill(court);
    await page
      .locator(`[data-testid^='court-selection-${orderId}-option-item-'][data-value='081']`)
      .click();
    await page.getByTestId(`new-case-input-${firstOrderId}`).fill('11-11111');
    await expect(page.getByTestId('alert-container-validation-not-found')).toBeVisible();

    const caseNumber = '18-61881';
    const summaryRequestPromise = page.waitForEvent('requestfinished', {
      predicate: (e) => e.url().includes(`/api/cases/081-${caseNumber}/summary`),
    });
    await page.getByTestId(`new-case-input-${firstOrderId}`).fill(caseNumber);
    await summaryRequestPromise;
    await expect(page.getByTestId('alert-container-validation-not-found')).not.toBeVisible();

    await expect(page.getByTestId(`validated-cases-row-0`)).toContainText(caseNumber);

    await expect(
      page.getByTestId(`button-accordion-approve-button-${firstOrderId}`),
    ).not.toBeDisabled();
    await page.getByTestId(`button-accordion-approve-button-${firstOrderId}`).click();
    await page
      .getByTestId(`button-confirm-modal-confirmation-modal-${firstOrderId}-cancel-button`)
      .click();
    await page.getByTestId(`button-accordion-reject-button-${firstOrderId}`).click();
    await page.getByTestId(`rejection-reason-input-confirmation-modal-${firstOrderId}`).click();
    await page
      .getByTestId(`rejection-reason-input-confirmation-modal-${firstOrderId}`)
      .fill('Rejecting because this case is not transferring.');

    await page
      .getByTestId(`modal-x-button-confirm-modal-confirmation-modal-${firstOrderId}`)
      .click();
    await page.getByTestId(`button-accordion-reject-button-${firstOrderId}`).click();

    await expect(
      page.getByTestId(`rejection-reason-input-confirmation-modal-${firstOrderId}`),
    ).toBeEmpty();

    await page
      .getByTestId(`modal-content-confirm-modal-confirmation-modal-${firstOrderId}`)
      .press('Escape');
    await page.getByTestId(`button-accordion-cancel-button-${firstOrderId}`).click();
    await expect(page.getByTestId(`validated-cases-row-0`)).not.toBeVisible();

    await expect(page.locator(`#court-selection-${orderId}-combo-box-input`)).not.toBeAttached();

    await expect(page.getByTestId(`new-case-input-${firstOrderId}`)).toBeDisabled();
  });

  test('should reset multiple input fields when Cancel is clicked', async ({ page }) => {
    // get pending transfer order id
    const pendingTransferOrder: Order = orderResponseBody.find(
      (o) => o.orderType === 'transfer' && o.status === 'pending',
    );
    expect(pendingTransferOrder).not.toBeFalsy();
    const orderId = pendingTransferOrder.id;

    // open accordion by order id
    await page.getByTestId(`accordion-button-order-list-${orderId}`).click();
    await page.getByTestId('button-radio-case-not-listed-radio-button-click-target').click();

    // fill in inputs
    await page.locator(`#court-selection-${orderId}-expand`).click();
    const court = 'manhattan';
    await page.locator(`#court-selection-${orderId}-combo-box-input`).fill(court);
    await page
      .locator(`[data-testid^='court-selection-${orderId}-option-item-'][data-value='081']`)
      .click();

    await page.getByTestId(`new-case-input-${orderId}`).isEnabled();

    const caseNumber = '18-61881';
    await page.getByTestId(`new-case-input-${orderId}`).fill(caseNumber);

    // Assert case number input
    const enteredCaseValue = await page.getByTestId(`new-case-input-${orderId}`).inputValue();
    expect(enteredCaseValue).toBe(caseNumber);

    // Action click Cancel
    await page.getByTestId(`button-accordion-cancel-button-${orderId}`).click();
    await expect(page.locator(`#court-selection-${orderId}-combo-box-input`)).not.toBeAttached();
  });
});
