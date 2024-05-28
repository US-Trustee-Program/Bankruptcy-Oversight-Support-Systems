import { expect } from '@playwright/test';
import { test } from './fixture/urlQueryString';
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

    // select substantive consolidation type
    const consolidationTypeSubstantive = page.getByTestId(
      `substantive-${pendingConsolidationOrder.id}-click-target`,
    );

    await consolidationTypeSubstantive.click();

    let childCaseCount = 0;
    if (isConsolidationOrder(pendingConsolidationOrder)) {
      childCaseCount = pendingConsolidationOrder.childCases.length;
    }

    for (let i = 0; i < childCaseCount; ++i) {
      // The following is neccessary because the USWDS checkbox input is rendered hidden off-screen.
      // Therefore playwright can't check the box if it can't see it using the normal page.getByTestId.
      // So using this method, you can locate the checkbox and fire a click event.
      // I tried getting the label by test id, but it can't click on the label because the checkbox
      // image is rendered in a css pseudo class, and javascript can not access the pseudo class.
      // Clicking the label did not seem to fire the click event on the checkbox input.
      await page
        .locator(
          `input[data-testid="checkbox-case-selection-case-list-${pendingConsolidationOrder.id}-${i}"]`,
        )
        .dispatchEvent('click');
    }

    // mark first child case as lead case
    const markAsLeadButton1 = page.getByTestId(
      `button-assign-lead-case-list-${pendingConsolidationOrder.id}-0`,
    );

    await markAsLeadButton1.click();

    // wait for loading assigned attorneys to complete
    await expect(page.locator(`.loading-spinner`)).toHaveCount(0, { timeout: 60000 });

    const approveButton = page.getByTestId(
      `button-accordion-approve-button-${pendingConsolidationOrder.id}`,
    );
    await approveButton.click();

    const modalConsolidationText = document.querySelector('.modal-consolidation-type');
    expect(modalConsolidationText).toContain('This will confirm the Substantive Consolidation of');
  });

  test('should open case-not-listed form, fill form and click validate button', async ({
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

    // select substantive consolidation type
    const consolidationTypeSubstantive = page.getByTestId(
      `substantive-${pendingConsolidationOrder.id}-click-target`,
    );

    await consolidationTypeSubstantive.click();

    await page
      .locator(
        `input[data-testid="checkbox-case-selection-case-list-${pendingConsolidationOrder.id}-0"]`,
      )
      .dispatchEvent('click');

    await page
      .locator(`lead-case-form-checkbox-toggle-${pendingConsolidationOrder.id}`)
      .dispatchEvent('click');

    // Action fill form for selecting a lead case not listed in child cases
    await page.locator('#lead-case-court div').first().click();
    await page.getByRole('option', { name: /Manhattan/ }).click();

    await page.getByTestId(`lead-case-input-${pendingConsolidationOrder.id}`).fill('11-11111');

    // Action click cancel
    await page
      .getByTestId(`button-accordion-approve-button-${pendingConsolidationOrder.id}`)
      .click();

    // Assert modal opened
    expect(
      page.getByTestId(`modal-overlay-confirmation-modal-${pendingConsolidationOrder.id}`),
    ).toBeVisible();
    expect(
      page.getByTestId(`button-confirmation-modal-${pendingConsolidationOrder.id}-submit-button`),
    ).toBeDisabled();
  });
});
