import { expect } from '@playwright/test';
import { test } from './fixture/urlQueryString';
import { Order, ConsolidationOrder } from '../../../common/src/cams/orders';
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
    const pendingConsolidationOrder = orderResponseBody.find(
      (o) => o.orderType === 'consolidation' && o.status === 'pending',
    ) as ConsolidationOrder;

    expect(pendingConsolidationOrder).not.toBeFalsy();
    await page.getByTestId('order-status-filter-transfer').click();
    await page.getByTestId(`accordion-button-order-list-${pendingConsolidationOrder.id}`).click();

    // select substantive consolidation type
    const consolidationTypeSubstantive = page.getByTestId(
      `button-radio-substantive-${pendingConsolidationOrder.id}-click-target`,
    );

    await consolidationTypeSubstantive.click();

    const memberCaseCount = pendingConsolidationOrder.memberCases.length;

    for (let i = 0; i < memberCaseCount; ++i) {
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
        .click();
    }

    // mark first member case as lead case
    const markAsLeadButton1 = page.getByTestId(
      `button-assign-lead-case-list-${pendingConsolidationOrder.id}-0`,
    );

    await markAsLeadButton1.click();

    await expect(
      page.getByTestId(`button-accordion-approve-button-${pendingConsolidationOrder.id}`),
    ).toBeEnabled();

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
    const pendingConsolidationOrder = orderResponseBody.find(
      (o) => o.orderType === 'consolidation' && o.status === 'pending',
    ) as ConsolidationOrder;

    expect(pendingConsolidationOrder).not.toBeFalsy();

    // Action update filter
    await page.getByTestId('order-status-filter-transfer').click();

    // Assert state of all filters
    await expect(page.getByTestId('order-status-filter-pending').locator('svg')).toBeVisible();
    await expect(page.getByTestId('order-status-filter-approved').locator('svg')).not.toBeVisible();
    await expect(page.getByTestId('order-status-filter-rejected').locator('svg')).not.toBeVisible();
    await expect(page.getByTestId('order-status-filter-transfer').locator('svg')).not.toBeVisible();
    await expect(
      page.getByTestId('order-status-filter-consolidation').locator('svg'),
    ).toBeVisible();

    // Action open accordion
    await page.getByTestId(`accordion-button-order-list-${pendingConsolidationOrder.id}`).click();

    // select substantive consolidation type
    const consolidationTypeSubstantive = page.getByTestId(
      `button-radio-substantive-${pendingConsolidationOrder.id}-click-target`,
    );

    await consolidationTypeSubstantive.click();

    await page
      .getByTestId(
        `button-checkbox-case-selection-case-list-${pendingConsolidationOrder.id}-0-click-target`,
      )
      .click();

    await page
      .getByTestId(`button-assign-lead-case-list-${pendingConsolidationOrder.id}-0`)
      .click();

    await page
      .getByTestId(
        `button-checkbox-case-selection-case-list-${pendingConsolidationOrder.id}-1-click-target`,
      )
      .click();

    // Open add case modal and check a case
    await page
      .getByTestId(`accordion-content-${pendingConsolidationOrder.id}`)
      .getByTestId('open-modal-button')
      .click();

    const caseNumber = '29-56291';
    await page.getByTestId(`add-case-input-${pendingConsolidationOrder.id}`).fill(caseNumber);

    await expect(
      page.getByTestId(`button-add-case-modal-${pendingConsolidationOrder.id}-submit-button`),
    ).toBeEnabled();

    await page
      .getByTestId(`button-add-case-modal-${pendingConsolidationOrder.id}-submit-button`)
      .click();

    // Action click validate (approve button)
    await expect(
      page.getByTestId(`button-accordion-approve-button-${pendingConsolidationOrder.id}`),
    ).toBeEnabled();

    await page
      .getByTestId(`button-accordion-approve-button-${pendingConsolidationOrder.id}`)
      .click();

    // Assert modal opened and is actionable
    await expect(
      page.getByTestId(`modal-overlay-confirmation-modal-${pendingConsolidationOrder.id}`),
    ).toBeVisible();

    await expect(
      page.getByTestId(`button-confirmation-modal-${pendingConsolidationOrder.id}-submit-button`),
    ).toBeEnabled();
  });
});
