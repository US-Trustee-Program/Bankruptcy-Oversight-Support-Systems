import { test, expect } from '@playwright/test';

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
  test('should reset multiple input fields when Cancel is clicked', async ({ page }) => {
    const orderResponsePromise = page.waitForResponse(
      async (response) => response.url().includes('api/order') && response.ok(),
      { timeout: 30000 },
    );
    await page.goto('/data-verification');
    expect(page.getByRole('heading', { name: 'Data Verification' })).toBeVisible();

    const orderResponse = await orderResponsePromise;
    const orderResponseBody = (await orderResponse.json()).body;

    console.log(orderResponseBody);

    // await expect(page.locator('#loading-spinner-svg')).not.toBeVisible();
  });
});

test('test', async ({ page }) => {
  // test.setTimeout(60000);
  const ordersRequestPromise = page.waitForEvent('requestfinished', {
    predicate: (e) => e.url().includes('api/orders'),
  });
  const officesRequestPromise = page.waitForEvent('requestfinished', {
    predicate: (e) => e.url().includes('api/offices'),
  });
  await page.goto('/data-verification');

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
  await page.getByTestId('order-status-filter-consolidation').click();
  await page.getByTestId(`accordion-button-order-list-${firstOrderId}`).click();

  await page.locator(`#court-selection-${firstOrderId}`).click();
  await page.getByLabel(`Select new court`).locator('visible=true').fill('manhattan');
  await page.getByLabel(`Select new court`).locator('visible=true').press('Enter');

  await expect(page.getByTestId('alert-container-validation-not-found')).toBeVisible();

  const caseNumber = '18-61881';
  const summaryRequestPromise = page.waitForEvent('requestfinished', {
    predicate: (e) => e.url().includes(`/api/cases/081-${caseNumber}/summary`),
  });
  await page.getByTestId(`new-case-input-${firstOrderId}`).fill(caseNumber);
  await summaryRequestPromise;
  // await page.on('requestfinished', (data) => data.response() !== null);
  await expect(page.getByTestId('alert-container-validation-not-found')).not.toBeVisible();

  await expect(page.getByTestId(`validated-cases-row-0`)).toContainText(caseNumber);

  await expect(
    page.getByTestId(`button-accordion-approve-button-${firstOrderId}`),
  ).not.toBeDisabled();
  await page.getByTestId(`button-accordion-approve-button-${firstOrderId}`).click();
  await page
    .getByTestId(`modal-content-confirm-modal-confirmation-modal-${firstOrderId}`)
    .getByTestId('toggle-modal-button-cancel')
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
  await expect(page.getByTestId(`new-case-input-${firstOrderId}`)).toBeDisabled();
  await expect(page.getByTestId(`new-case-input-${firstOrderId}`)).toHaveValue(
    firstOrder.docketSuggestedCaseNumber,
  );
  await expect(page.getByLabel(`Select new court`).locator('visible=true')).toHaveValue('');

  const page1Promise = page.waitForEvent('popup');
  await page.getByTestId(`approved-transfer-original-case-link-${firstOrder.caseId}-link`).click();
  const page1 = await page1Promise;
  // const page1DetailPromise = page1.waitForEvent('requestfinished', {
  //   predicate: (e) => e.url() === `http://localhost:7071/api/cases/081-${caseNumber}/summary`,
  // });
  // await expect(page1.getByTestId('case-detail-heading')).toHaveText(firstOrder.caseTitle);
  // await page1.waitForTimeout(30000);
  // await expect(page1.getByTestId('case-number')).toHaveText(firstOrder.caseId.slice(4));
  await expect(page1.url()).toEqual(`http://localhost:3000/case-detail/${firstOrder.caseId}/`);
});
