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

  test('should open consolidation modal, fill form and close modal by clicking cancel', async ({
    page,
  }) => {
    // get pending consolidation order id
    const pendingConsolidationOrder: Order = orderResponseBody.find(
      (o) => o.orderType === 'consolidation' && o.status === 'pending',
    );
    expect(pendingConsolidationOrder).not.toBeFalsy();

    // Action update filter
    await page.getByTestId('order-status-filter-transfer').click();

    // Assert state of all filters
    expect(page.getByTestId('order-status-filter-pending').locator('svg')).toBeVisible();
    expect(page.getByTestId('order-status-filter-approved').locator('svg')).not.toBeVisible();
    expect(page.getByTestId('order-status-filter-rejected').locator('svg')).not.toBeVisible();
    expect(page.getByTestId('order-status-filter-transfer').locator('svg')).not.toBeVisible();
    expect(page.getByTestId('order-status-filter-consolidation').locator('svg')).toBeVisible();

    // Action open accordian
    await page.getByTestId(`accordion-button-order-list-${pendingConsolidationOrder.id}`).click();

    await page.getByTestId(`${pendingConsolidationOrder.id}-case-list-checkbox-0`).check();

    await page
      .getByTestId(`button-accordion-approve-button-${pendingConsolidationOrder.id}`)
      .click();

    // Assert modal opened
    expect(
      page.getByTestId(`modal-overlay-confirmation-modal-${pendingConsolidationOrder.id}`),
    ).toBeVisible();
    expect(
      page
        .getByTestId(`modal-content-confirmation-modal-${pendingConsolidationOrder.id}`)
        .getByTestId('toggle-modal-button-submit'),
    ).toBeDisabled();

    // Action fill modal dialog form
    await page
      .getByTestId(
        `radio-administrative-confirmation-modal-${pendingConsolidationOrder.id}-click-target`,
      )
      .check();

    await page.locator('#lead-case-court div').filter({ hasText: 'Select...' }).first().click();
    await page.getByRole('option', { name: /Brooklyn/ }).click();

    await page
      .getByTestId(`lead-case-input-confirmation-modal-${pendingConsolidationOrder.id}`)
      .fill('11-11111');

    // Action click cancel
    await page
      .getByTestId(`modal-content-confirmation-modal-${pendingConsolidationOrder.id}`)
      .getByTestId('toggle-modal-button-cancel')
      .click();

    // Assert modal closed and approve button is disabled
    expect(
      page.getByTestId(`modal-overlay-confirmation-modal-${pendingConsolidationOrder.id}`),
    ).not.toBeVisible();
    expect(
      page.getByTestId(`button-accordion-approve-button-${pendingConsolidationOrder.id}`),
    ).toBeDisabled();
  });
});
