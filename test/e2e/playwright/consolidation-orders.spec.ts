import { expect } from '@playwright/test';
import { test } from './fixture/urlQueryString';
import { Order, isConsolidationOrder } from '../../../common/src/cams/orders';
import { logout } from './login/login-helpers';

const timeoutOption = { timeout: 30000 };

test.describe('Consolidation Orders', () => {
  let orderResponseBody: Array<Order>;
  let officesRequestPromise;
  let orderResponsePromise;

  test.beforeEach(async ({ page }) => {
    // Navigate to Data Verification and capture network responses
    await page.goto('/data-verification');
    orderResponsePromise = page.waitForResponse(
      async (response) => response.url().includes('api/order') && response.ok(),
      timeoutOption,
    );
    officesRequestPromise = page.waitForEvent('requestfinished', {
      predicate: (e) => e.url().includes('api/courts'),
      timeout: 30000,
    });
    await expect(page.getByTestId('header-data-verification-link')).toBeVisible();
    await expect(page.getByTestId('accordion-group')).toBeVisible();

    await officesRequestPromise;

    const orderResponse = await orderResponsePromise;
    orderResponseBody = (await orderResponse.json()).data;

    expect(orderResponseBody).not.toBeFalsy();
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
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
      `button-radio-substantive-${pendingConsolidationOrder.id}-click-target`,
    );

    await consolidationTypeSubstantive.click();

    let childCaseCount = 0;
    let firstChildCaseId;
    if (isConsolidationOrder(pendingConsolidationOrder)) {
      childCaseCount = pendingConsolidationOrder.childCases.length;
      firstChildCaseId = pendingConsolidationOrder.childCases[0].caseId;
    }

    for (let i = 0; i < childCaseCount; ++i) {
      // The following is necessary because the USWDS checkbox input is rendered hidden off-screen.
      // Therefore, playwright can't check the box if it can't see it using the normal page.getByTestId.
      // So using this method, you can locate the checkbox and fire a click event.
      // I tried getting the label by test id, but it can't click on the label because the checkbox
      // image is rendered in a css pseudo class, and javascript can not access the pseudo class.
      // Clicking the label did not seem to fire the click event on the checkbox input.
      await page
        .locator(
          `button[data-testid="button-checkbox-case-selection-case-list-${pendingConsolidationOrder.id}-${i}-click-target"]`,
        )
        .dispatchEvent('click');
    }

    // mark first child case as lead case
    const markAsLeadButton1 = await page.getByTestId(
      `button-assign-lead-case-list-${pendingConsolidationOrder.id}-0`,
    );

    // wait for loading assigned attorneys to complete
    await page.waitForSelector(
      `#loading-spinner-case-assignment-${firstChildCaseId}`,
      timeoutOption,
    );

    await markAsLeadButton1.click();

    const approveButton = page.getByTestId(
      `button-accordion-approve-button-${pendingConsolidationOrder.id}`,
    );

    await approveButton.isEnabled(timeoutOption);
    await approveButton.click();

    const modalConsolidationText = await page.waitForSelector('.modal-consolidation-type');
    expect(await modalConsolidationText.textContent()).toEqual(
      'This will confirm the Substantive Consolidation of the following cases.',
    );
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
      `button-radio-substantive-${pendingConsolidationOrder.id}-click-target`,
    );

    await consolidationTypeSubstantive.click();

    let firstChildCaseId;
    if (isConsolidationOrder(pendingConsolidationOrder)) {
      firstChildCaseId = pendingConsolidationOrder.childCases[0].caseId.slice(4);
    }

    await page
      .locator(
        `button[data-testid="button-checkbox-case-selection-case-list-${pendingConsolidationOrder.id}-0-click-target"]`,
      )
      .dispatchEvent('click');

    await page
      .locator(
        `#checkbox-lead-case-form-checkbox-toggle-${pendingConsolidationOrder.id}-click-target`,
      )
      .dispatchEvent('click');

    // Action fill form for selecting a lead case not listed in child cases

    await page
      .getByTestId(`lead-case-input-${pendingConsolidationOrder.id}`)
      .fill(firstChildCaseId);

    // wait for loading assigned attorneys to complete
    await page.waitForSelector(
      `#lead-case-number-loading-spinner-${pendingConsolidationOrder.id}`,
      timeoutOption,
    );
    await page.waitForSelector(
      `#valid-case-number-found-${pendingConsolidationOrder.id}`,
      timeoutOption,
    );

    // Action click validate (approve button)
    await expect(
      page.getByTestId(`button-accordion-approve-button-${pendingConsolidationOrder.id}`),
    ).toBeEnabled();

    await page
      .getByTestId(`button-accordion-approve-button-${pendingConsolidationOrder.id}`)
      .click();

    // Assert modal opened and is actionable
    expect(
      page.getByTestId(`modal-overlay-confirmation-modal-${pendingConsolidationOrder.id}`),
    ).toBeVisible();
    expect(
      page.getByTestId(`button-confirmation-modal-${pendingConsolidationOrder.id}-submit-button`),
    ).toBeEnabled();
  });
});
