import { test, expect } from '@playwright/test';
import { Order, isConsolidationOrder } from '../../../common/src/cams/orders';

test.describe('Consolidation Orders', () => {
  let orderResponseBody: Array<Order>;

  test.beforeEach(async ({ page }) => {
    // Navigate to Data Verification and capture network responses
    const orderResponsePromise = page.waitForResponse(
      async (response) => response.url().includes('api/order') && response.ok(),
      { timeout: 30000 },
    );
    const officesRequestPromise = page.waitForEvent('requestfinished', {
      predicate: (e) => e.url().includes('api/offices'),
    });

    await page.goto('/data-verification');
    expect(page.locator('h1')).toHaveText('Data Verification');
    await officesRequestPromise;

    const orderResponse = await orderResponsePromise;
    orderResponseBody = (await orderResponse.json()).body;

    expect(orderResponseBody).not.toBeFalsy();
  });

  test('should select correct consolidationType radio when approving a consolidation', async ({
    page,
  }) => {
    // test.setTimeout(60000);

    await page.goto('/data-verification');

    // get pending consolidation order id
    const pendingConsolidationOrder: Order = orderResponseBody.find(
      (o) => o.orderType === 'consolidation' && o.status === 'pending',
    );
    expect(pendingConsolidationOrder).not.toBeFalsy();
    await page.getByTestId('order-status-filter-transfer').click();
    await page.getByTestId(`accordion-button-order-list-${pendingConsolidationOrder.id}`).click();

    let childCaseCount = 0;
    if (isConsolidationOrder(pendingConsolidationOrder)) {
      childCaseCount = pendingConsolidationOrder.childCases.length;
    }

    for (let i = 0; i < childCaseCount; ++i) {
      const checkbox = await page.getByTestId(
        `${pendingConsolidationOrder.id}-case-list-checkbox-${i}`,
      );
      checkbox.check();
    }

    const approveButton = page.getByTestId(
      `button-accordion-approve-button-${pendingConsolidationOrder.id}`,
    );
    await approveButton.click();

    const jointAdminType = page.getByTestId(
      `radio-administrative-confirmation-modal-${pendingConsolidationOrder.id}-click-target`,
    );

    expect(jointAdminType).toBeInViewport();
  });
});
