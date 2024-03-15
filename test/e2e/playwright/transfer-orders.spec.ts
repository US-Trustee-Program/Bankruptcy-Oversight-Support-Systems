import { test } from '@playwright/test';

interface Order {
  id: string;
  orderType: string;
  status: string;
}

interface OrdersResponse {
  body: Array<Order>;
}

test('test', async ({ page }) => {
  const requestPromise = page.waitForEvent('requestfinished', {
    predicate: (e) => e.url() === 'http://localhost:7071/api/orders',
  });
  await page.goto('http://localhost:3000/data-verification');

  const request = await requestPromise;
  const response = await request.response();
  const ordersResponse = (await response?.json()) as OrdersResponse;
  const orders = ordersResponse.body;
  const pendingTransfers = orders.filter(
    (o) => o.orderType === 'transfer' && o.status === 'pending',
  );
  const firstOrder = pendingTransfers[0] ?? null;
  const firstOrderId = firstOrder.id;

  await page.getByTestId('order-status-filter-consolidation').click();
  await page.locator(`[data-testid="accordion-button-order-list-${firstOrderId}"]`).click();

  // await page.locator('.new-court__select:first-child input').click();
  // await page.getByLabel('Select new court').fill('manhattan');
  // await page.getByLabel('Select new court').press('Enter');
  // await page.getByLabel('New Case').fill('18-61881');
  // await page.getByTestId(`button-accordion-approve-button-${firstOrderId}`).click();
  // await page
  //   .getByTestId(`modal-content-confirm-modal-confirmation-modal-${firstOrderId}`)
  //   .getByTestId('toggle-modal-button-cancel')
  //   .click();
  // await page.getByTestId(`button-accordion-approve-button-${firstOrderId}`).click();
  // await page.getByTestId(`modal-x-button-confirm-modal-confirmation-modal-${firstOrderId}`).click();
  // await page.getByTestId(`button-accordion-approve-button-${firstOrderId}`).click();
  // await page.getByTestId(`modal-overlay-confirm-modal-confirmation-modal-${firstOrderId}`).click();
  // await page.getByTestId(`modal-overlay-confirm-modal-confirmation-modal-${firstOrderId}`).click();
  // await page.getByTestId(`modal-overlay-confirm-modal-confirmation-modal-${firstOrderId}`).click();
  // await page.getByTestId(`modal-overlay-confirm-modal-confirmation-modal-${firstOrderId}`).click();
  // await page.getByText('This will approve the').press('Escape');
  // await page.getByTestId(`button-accordion-reject-button-${firstOrderId}`).click();
  // await page.getByTestId(`rejection-reason-input-confirmation-modal-${firstOrderId}`).click();
  // await page
  //   .getByTestId(`rejection-reason-input-confirmation-modal-${firstOrderId}`)
  //   .fill('Rejecting because this case is not transferring.');
  // await page
  //   .getByTestId(`modal-content-confirm-modal-confirmation-modal-${firstOrderId}`)
  //   .getByTestId('toggle-modal-button-cancel')
  //   .click();
  // await page.getByTestId(`button-accordion-reject-button-${firstOrderId}`).click();
  // await page.getByTestId(`modal-x-button-confirm-modal-confirmation-modal-${firstOrderId}`).click();
  // await page.getByTestId(`button-accordion-cancel-button-${firstOrderId}`).click();
  // // const page1Promise = page.waitForEvent('popup');
  // await page.getByTestId('approved-transfer-original-case-link-081-60-76791-link').click();
  // // const page1 = await page1Promise;
});
