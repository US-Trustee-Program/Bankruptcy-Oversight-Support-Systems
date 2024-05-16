import { expect } from '@playwright/test';
import { test } from './fixture/urlQueryString';

interface Order {
  id: string;
  caseId: string;
  caseTitle: string;
  orderType: string;
  status: string;
  docketSuggestedCaseNumber: string;
}

interface OrdersResponse {
  body: Array<Order>;
}

test.describe('Transfer Orders', () => {
  let orderResponseBody: Array<Order>;

  test.beforeEach(async ({ page }) => {
    // Navigate to Data Verification and capture network responses
    const orderResponsePromise = page.waitForResponse(
      async (response) => response.url().includes('api/order') && response.ok(),
      { timeout: 30000 },
    );

    await page.goto('/data-verification');
    expect(page.getByRole('heading', { name: 'Data Verification' })).toBeVisible();

    const orderResponse = await orderResponsePromise;
    orderResponseBody = (await orderResponse.json()).body;

    expect(orderResponseBody).not.toBeFalsy();
  });

  test('should reset multiple input fields when Cancel is clicked', async ({ page }) => {
    // get pending transfer order id
    const pendingTransferOrder: Order = orderResponseBody.find(
      (o) => o.orderType === 'transfer' && o.status === 'pending',
    );
    expect(pendingTransferOrder).not.toBeFalsy();
    const orderId = pendingTransferOrder.id;

    // open accordian by order id
    await page.getByTestId(`accordion-button-order-list-${orderId}`).click();
    await page.getByTestId('suggested-cases-radio-empty').click();

    // fill in inputs
    await page.locator(`#court-selection-${orderId}`).click();
    const court = 'manhattan';
    await page.getByLabel(`New court`).locator('visible=true').fill(court);
    await page.getByLabel(`New court`).locator('visible=true').press('Enter');

    await page.getByTestId(`new-case-input-${orderId}`).isEnabled();

    const caseNumber = '18-61881';
    await page.getByTestId(`new-case-input-${orderId}`).fill(caseNumber);

    // Assert case number input
    const enteredCaseValue = await page.getByTestId(`new-case-input-${orderId}`).inputValue();
    expect(enteredCaseValue).toBe(caseNumber);

    // Action click Cancel
    page.getByTestId(`button-accordion-cancel-button-${orderId}`).click();
    await expect(page.getByTestId(`new-case-input-${orderId}`)).not.toBeVisible();
  });
});

test('test pending transfer order form', async ({ page }) => {
  const orderResponsePromise = page.waitForResponse(
    async (response) => response.url().includes('api/order') && response.ok(),
    { timeout: 30000 },
  );

  await page.goto('/data-verification');
  expect(page.getByRole('heading', { name: 'Data Verification' })).toBeVisible();
  const orderResponse = await orderResponsePromise;
  const orderResponseBody = (await orderResponse.json()).body;

  expect(orderResponseBody).not.toBeFalsy();

  const ordersRequestPromise = page.waitForEvent('requestfinished', {
    predicate: (e) => e.url().includes('api/orders'),
  });
  const officesRequestPromise = page.waitForEvent('requestfinished', {
    predicate: (e) => e.url().includes('api/offices'),
  });
  await page.goto('/data-verification');

  // get pending transfer order id
  const pendingTransferOrder: Order = orderResponseBody.find(
    (o) => o.orderType === 'transfer' && o.status === 'pending',
  );
  expect(pendingTransferOrder).not.toBeFalsy();
  const orderId = pendingTransferOrder.id;

  // open accordian by order id
  await page.getByTestId(`accordion-button-order-list-${orderId}`).click();

  // Wait on the offices to come back from API
  await officesRequestPromise;

  // Wait for the transfer orders.
  const request = await ordersRequestPromise;
  const response = await request.response();
  const ordersResponse = (await response?.json()) as OrdersResponse;
  const orders = ordersResponse.body;
  const pendingTransfers = orders.filter(
    (o) => o.orderType === 'transfer' && o.status === 'pending',
  );
  const firstOrder = pendingTransfers[0] ?? null;
  const firstOrderId = firstOrder.id;

  // Start testing the UI
  await page.getByTestId('suggested-cases-radio-empty').click();

  await page.getByLabel(`New court`).locator('visible=true').fill('manhattan');
  await page.getByLabel(`New court`).locator('visible=true').press('Enter');

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

  await page.getByTestId(`modal-x-button-confirm-modal-confirmation-modal-${firstOrderId}`).click();
  await page.getByTestId(`button-accordion-reject-button-${firstOrderId}`).click();

  await expect(
    page.getByTestId(`rejection-reason-input-confirmation-modal-${firstOrderId}`),
  ).toBeEmpty();

  await page
    .getByTestId(`modal-content-confirm-modal-confirmation-modal-${firstOrderId}`)
    .press('Escape');
  await page.getByTestId(`button-accordion-cancel-button-${firstOrderId}`).click();
  await expect(page.getByTestId(`validated-cases-row-0`)).not.toBeVisible();

  await page.getByTestId('suggested-cases-radio-empty').click();
  await expect(page.getByLabel(`New court`).locator('visible=true')).toHaveValue('');
  await expect(page.getByTestId(`new-case-input-${firstOrderId}`)).toBeDisabled();
});

test.skip('test opening link to case detail screen', async () => {
  // TODO: Fix opening a new tab to the case detail screen.
  // const page1Promise = page.waitForEvent('popup');
  // await page.getByTestId(`case-detail-${firstOrder.caseId}-${orderId}-link`).click();
  // const page1 = await page1Promise;
  // expect(page1.url()).toContain(`/case-detail/${firstOrder.caseId}/`);
});
