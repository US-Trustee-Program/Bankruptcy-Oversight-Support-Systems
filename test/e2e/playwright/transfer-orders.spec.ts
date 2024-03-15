import { test } from '@playwright/test';

// interface Order {
//   id: string;
//   orderType: string;
//   status: string;
// }

// interface OrdersResponse {
//   body: Array<Order>;
// }

test('test', async ({ page }) => {
  const orderResponsePromise = page.waitForResponse(
    (response) =>
      response.url() === 'http://localhost:3000/api/orders' &&
      response.request().method() === 'GET',
    { timeout: 0 },
  );
  await page.goto('http://localhost:3000/data-verification');
  const response = await orderResponsePromise;

  console.log(JSON.stringify(response));

  // const body = (await orderResponsePromise).body;
  // const orderResponse = body as unknown as OrdersResponse;
  // console.log(orderResponse);
  // const pendingTransfers = orderResponse.body.filter(
  //   (o) => o.orderType === 'transfer' && o.status === 'pending',
  // );
  // const firstOrderId = pendingTransfers[0].id || null;

  // await page.getByTestId('order-status-filter-consolidation').click();
  // await page.locator('.usa-accordion__heading:first-child button').click();
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
