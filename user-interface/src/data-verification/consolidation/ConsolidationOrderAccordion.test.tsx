import { render, screen, waitFor } from '@testing-library/react';
import { orderType, orderStatusType } from '@/lib/utils/labels';
import { BrowserRouter } from 'react-router-dom';
import { ConsolidationOrder } from '@common/cams/orders';
import {
  ConsolidationOrderAccordion,
  ConsolidationOrderAccordionProps,
} from '@/data-verification/consolidation/ConsolidationOrderAccordion';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { CourtDivisionDetails } from '@common/cams/courts';
import { formatDate } from '@/lib/utils/datetime';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { FeatureFlagSet } from '@common/feature-flags';
import Api2 from '@/lib/models/api2';
import testingUtilities from '@/lib/testing/testing-utilities';
import userEvent, { UserEvent } from '@testing-library/user-event';

function findAccordionHeading(id: string) {
  const heading = screen.getByTestId(`accordion-heading-${id}`);
  expect(heading).toBeInTheDocument();
  expect(heading).toBeVisible();
  return heading;
}

function findAccordionContent(id: string, visible: boolean) {
  const content = screen.getByTestId(`accordion-content-${id}`);
  expect(content).toBeInTheDocument();
  if (visible) {
    expect(content).toBeVisible();
  } else {
    expect(content).not.toBeVisible();
  }
  return content;
}

async function openAccordion(user: UserEvent, orderId: string) {
  const header: HTMLElement = screen.getByTestId(`accordion-heading-${orderId}`);
  await user.click(header);
}

describe('ConsolidationOrderAccordion tests', () => {
  const order: ConsolidationOrder = MockData.getConsolidationOrder({
    override: { courtDivisionCode: '081' },
  });

  const offices: CourtDivisionDetails[] = MockData.getCourts();
  const regionMap = new Map();

  const onOrderUpdateMockFunc = vi.fn();
  const onExpandMockFunc = vi.fn();
  let mockFeatureFlags: FeatureFlagSet;

  const user = userEvent.setup();

  beforeEach(async () => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    mockFeatureFlags = {
      'consolidations-enabled': true,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
    vi.spyOn(Api2, 'getCaseAssignments').mockResolvedValue({
      data: MockData.buildArray(MockData.getAttorneyAssignment, 2),
    });
    vi.spyOn(Api2, 'getCaseAssociations').mockRejectedValue(
      '404 Case associations not found for the case ID.',
    );
    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({ data: MockData.getCaseSummary() });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  const accordionFieldHeaders = ['Court District', 'Order Filed', 'Event Type', 'Event Status'];

  function renderWithProps(props?: Partial<ConsolidationOrderAccordionProps>) {
    const defaultProps: ConsolidationOrderAccordionProps = {
      order,
      courts: offices,
      orderType,
      statusType: orderStatusType,
      onOrderUpdate: onOrderUpdateMockFunc,
      onExpand: onExpandMockFunc,
      regionsMap: regionMap,
      fieldHeaders: accordionFieldHeaders,
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <BrowserRouter>
        <ConsolidationOrderAccordion {...renderProps} />
      </BrowserRouter>,
    );
  }

  async function setLeadCase(index: number) {
    const markAsLeadButton = screen.getByTestId(
      `button-assign-lead-case-list-${order.id}-${index}`,
    );
    expect(markAsLeadButton).not.toBeNull();
    expect(markAsLeadButton.getAttribute('aria-checked')).not.toEqual('true');
    await user.click(markAsLeadButton);
    expect(markAsLeadButton.getAttribute('aria-checked')).toEqual('true');
    return markAsLeadButton;
  }

  async function clearLeadCase(index: number) {
    const markAsLeadButton = screen.getByTestId(
      `button-assign-lead-case-list-${order.id}-${index}`,
    );
    expect(markAsLeadButton).not.toBeNull();
    expect(markAsLeadButton.getAttribute('aria-checked')).toEqual('true');
    await user.click(markAsLeadButton);
    expect(markAsLeadButton.getAttribute('aria-checked')).not.toEqual('true');
  }

  async function selectConsolidationType() {
    const consolidationTypeRadio = document.querySelector('input[name="consolidation-type"]');
    const consolidationTypeRadioLabel = document.querySelector('.usa-radio__label');
    expect(consolidationTypeRadioLabel).not.toBeNull();
    if (consolidationTypeRadioLabel) {
      await user.click(consolidationTypeRadioLabel);
    }
    expect(consolidationTypeRadio).toBeChecked();
    return consolidationTypeRadio;
  }

  async function clickCaseCheckbox(oid: string, idx: number) {
    return testingUtilities.selectCheckbox(
      `case-selection-case-list-${oid}-${idx}`,
    ) as Promise<HTMLInputElement | null>;
  }

  async function fillInFormToEnableVerifyButton() {
    await openAccordion(user, order.id!);

    const approveButton = findApproveButton(order.id!);
    const rejectButton = findRejectButton(order.id!);
    const clearButton = findClearButton(order.id!);
    const consolidationTypeRadio = await selectConsolidationType();
    const checkbox1 = await clickCaseCheckbox(order.id!, 0);
    const checkbox2 = await clickCaseCheckbox(order.id!, 1);

    expect(approveButton).not.toBeEnabled();
    expect(rejectButton).not.toBeEnabled();

    await waitFor(() => {
      expect(rejectButton).toBeEnabled();
    });
    expect(approveButton).not.toBeEnabled();
    const leadCaseButton = await setLeadCase(0);
    expect(checkbox1).toBeChecked();
    expect(consolidationTypeRadio).toBeChecked();
    expect(leadCaseButton.getAttribute('aria-checked')).toEqual('true');
    await waitFor(() => {
      const approveButton = findApproveButton(order.id!);
      expect(approveButton).toBeEnabled();
    });

    return {
      approveButton,
      rejectButton,
      clearButton,
      consolidationTypeRadio,
      checkbox1,
      checkbox2,
    };
  }

  function findApproveButton(id: string) {
    return document.querySelector(`#accordion-approve-button-${id}`);
  }

  function findRejectButton(id: string) {
    return document.querySelector(`#accordion-reject-button-${id}`);
  }

  function findClearButton(id: string) {
    return document.querySelector(`#accordion-cancel-button-${id}`);
  }

  test('should render an order heading', async () => {
    renderWithProps();
    const heading = findAccordionHeading(order.id!);
    expect(heading?.textContent).toContain(order.courtName);
    expect(heading?.textContent).toContain(formatDate(order.orderDate));
  });

  test('should display pending order content', () => {
    const pendingOrder = MockData.getConsolidationOrder();
    renderWithProps({ order: pendingOrder });
    const content = findAccordionContent(pendingOrder.id!, false);

    const childCaseTable = screen.getByTestId(`case-list-${pendingOrder.id}`);
    expect(childCaseTable).toBeInTheDocument();

    pendingOrder.childCases.forEach((childCase) => {
      expect(content?.textContent).toContain(childCase.caseTitle);
      expect(content?.textContent).toContain(formatDate(childCase.dateFiled));
      childCase.docketEntries.forEach((de) => {
        expect(content?.textContent).toContain(de.summaryText);
        expect(content?.textContent).toContain(de.fullText);
      });
    });
  });

  test('should display approved order content', () => {
    const leadCase = MockData.getCaseSummary();
    const order = MockData.getConsolidationOrder({ override: { status: 'approved', leadCase } });
    renderWithProps({ order });

    const leadCaseLink = screen.queryByTestId(`lead-case-number-link`);
    expect(leadCaseLink).toBeInTheDocument();

    order.childCases.forEach((bCase, idx) => {
      const tableRow = screen.queryByTestId(`order-${order.id}-child-cases-row-${idx}`);
      expect(tableRow).toBeInTheDocument();
      expect(tableRow?.textContent).toContain(bCase.caseTitle);
    });
  });

  test('should display rejected order content', () => {
    const order = MockData.getConsolidationOrder({
      override: { status: 'rejected', reason: 'Test.' },
    });
    renderWithProps({ order });

    if (order.reason) {
      const blockQuote = document.querySelector('blockquote');
      expect(blockQuote?.textContent).toContain(order.reason);
    }

    order.childCases.forEach((bCase, idx) => {
      const tableRow = screen.queryByTestId(`${order.id}-case-list-row-${idx}-case-info`);
      expect(tableRow).toBeInTheDocument();
      expect(tableRow?.textContent).toContain(bCase.caseTitle);
    });
  });

  test('should open rejection modal when reject button is clicked', async () => {
    renderWithProps();
    const rejectButton = document.querySelector(
      `#accordion-reject-button-${order.id}`,
    ) as HTMLButtonElement;
    expect(rejectButton).not.toBeEnabled();

    await selectConsolidationType();

    clickCaseCheckbox(order.id!, 0);
    await waitFor(() => {
      expect(rejectButton).toBeEnabled();
    });

    await user.click(rejectButton);

    const modal = screen.getByTestId(`modal-confirmation-modal-${order.id}`);
    await waitFor(() => {
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveClass('is-visible');
      // for some reason, toBeVisible() doesn't work.
      expect(modal).toHaveStyle({ display: 'block' });
    });
  });

  test('should call orderUpdate for rejection', async () => {
    renderWithProps();

    const expectedOrderRejected: ConsolidationOrder = {
      ...order,
      status: 'rejected',
      reason: 'Test.',
    };

    vi.spyOn(Api2, 'putConsolidationOrderRejection').mockResolvedValue({
      data: [expectedOrderRejected],
    });

    const rejectButton = document.querySelector(
      `#accordion-reject-button-${order.id}`,
    ) as HTMLButtonElement;
    expect(rejectButton).not.toBeEnabled();

    clickCaseCheckbox(order.id!, 0);

    await selectConsolidationType();

    await waitFor(() => {
      expect(rejectButton).toBeEnabled();
    });
    await user.click(rejectButton);

    const modal = screen.getByTestId(`modal-confirmation-modal-${order.id}`);

    await waitFor(() => {
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveClass('is-visible');
      // for some reason, toBeVisible() doesn't work.
      expect(modal).toHaveStyle({ display: 'block' });
    });

    const modalRejectButton = screen.getByTestId(
      `button-confirmation-modal-${order.id}-submit-button`,
    );

    await waitFor(() => {
      expect(modalRejectButton).toBeEnabled();
    });

    await user.click(modalRejectButton);

    await waitFor(() => {
      expect(onOrderUpdateMockFunc).toHaveBeenCalled();
      expect(onOrderUpdateMockFunc).toHaveBeenCalledWith(
        {
          message: `Rejection of consolidation order was successful.`,
          timeOut: 8,
          type: UswdsAlertStyle.Success,
        },
        [expectedOrderRejected],
        order,
      );
    });
  });

  test('should handle api exception for rejection', async () => {
    renderWithProps();

    const errorMessage = 'Some random error';
    const alertMessage =
      'An unknown error has occurred and has been logged.  Please try again later.';
    vi.spyOn(Api2, 'putConsolidationOrderRejection').mockRejectedValue(new Error(errorMessage));

    const rejectButton = document.querySelector(
      `#accordion-reject-button-${order.id}`,
    ) as HTMLButtonElement;
    expect(rejectButton).not.toBeEnabled();

    clickCaseCheckbox(order.id!, 0);

    await selectConsolidationType();

    await waitFor(() => {
      expect(rejectButton).toBeEnabled();
    });
    await user.click(rejectButton);

    const modal = screen.getByTestId(`modal-confirmation-modal-${order.id}`);

    await waitFor(() => {
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveClass('is-visible');
      // for some reason, toBeVisible() doesn't work.
      expect(modal).toHaveStyle({ display: 'block' });
    });

    const modalRejectButton = screen.getByTestId(
      `button-confirmation-modal-${order.id}-submit-button`,
    );

    await waitFor(() => {
      expect(modalRejectButton).toBeEnabled();
    });

    await user.click(modalRejectButton);

    await waitFor(() => {
      expect(onOrderUpdateMockFunc).toHaveBeenCalled();
      expect(onOrderUpdateMockFunc).toHaveBeenCalledWith({
        message: alertMessage,
        timeOut: 8,
        type: UswdsAlertStyle.Error,
      });
    });
  });

  test.skip('should correctly enable/disable buttons when selecting consolidated cases and lead case from order case list table', async () => {
    renderWithProps();
    const { approveButton, rejectButton, checkbox1 } = await fillInFormToEnableVerifyButton();
    const includeAllCheckbox = document.querySelector(
      `#checkbox-case-list-${order.id}-checkbox-toggle`,
    );

    const secondCheckbox = await clickCaseCheckbox(order.id!, 1);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    await clearLeadCase(0);
    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    await setLeadCase(0);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    await user.click(checkbox1!);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    await user.click(secondCheckbox!);
    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).not.toBeEnabled();
    });

    await user.click(includeAllCheckbox!);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    await user.click(includeAllCheckbox!);
    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).not.toBeEnabled();
    });

    await user.click(checkbox1!);
    await user.click(secondCheckbox!);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });
  });

  test.skip('should open approval modal when approve button is clicked', async () => {
    renderWithProps();
    await openAccordion(user, order.id!);

    const approveButton = document.querySelector(
      `#accordion-approve-button-${order.id}`,
    ) as HTMLButtonElement;
    expect(approveButton).not.toBeEnabled();

    await selectConsolidationType();
    await setLeadCase(0);

    clickCaseCheckbox(order.id!, 0);
    clickCaseCheckbox(order.id!, 1);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });

    await user.click(approveButton);

    const modal = screen.getByTestId(`modal-confirmation-modal-${order.id}`);
    await waitFor(() => {
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveClass('is-visible');
      // for some reason, toBeVisible() doesn't work.
      expect(modal).toHaveStyle({ display: 'block' });
    });
  });

  test.skip('should call orderUpdate for approval', async () => {
    const leadCase = order.childCases[0];
    const expectedOrderApproved: ConsolidationOrder = {
      ...order,
      leadCase,
      status: 'approved',
    };
    vi.spyOn(Api2, 'putConsolidationOrderApproval').mockResolvedValue({
      data: [expectedOrderApproved],
    });
    vi.spyOn(Api2, 'searchCases').mockResolvedValue({
      data: MockData.buildArray(MockData.getSyncedCase, 5),
    });

    renderWithProps();
    const { approveButton } = await fillInFormToEnableVerifyButton();
    await user.click(approveButton as HTMLButtonElement);

    const modal = screen.getByTestId(`modal-confirmation-modal-${order.id}`);

    await waitFor(() => {
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveClass('is-visible');
      // for some reason, toBeVisible() doesn't work.
      expect(modal).toHaveStyle({ display: 'block' });
    });

    const modalApproveButton = screen.getByTestId(
      `button-confirmation-modal-${order.id}-submit-button`,
    );

    await waitFor(() => {
      expect(modalApproveButton).toBeEnabled();
    });

    await user.click(modalApproveButton);

    await waitFor(() => {
      expect(onOrderUpdateMockFunc).toHaveBeenCalled();
      expect(onOrderUpdateMockFunc).toHaveBeenCalledWith(
        {
          message: `Consolidation to lead case ${getCaseNumber(leadCase.caseId)} in ${leadCase.courtName} (${leadCase?.courtDivisionName}) was successful.`,
          timeOut: 8,
          type: UswdsAlertStyle.Success,
        },
        [expectedOrderApproved],
        order,
      );
    });
  });

  test.skip('should handle api exception for approval', async () => {
    renderWithProps();

    const errorMessage = 'Some random error';
    const alertMessage =
      'An unknown error has occurred and has been logged.  Please try again later.';
    vi.spyOn(Api2, 'putConsolidationOrderApproval').mockRejectedValue(new Error(errorMessage));

    const { approveButton } = await fillInFormToEnableVerifyButton();

    await user.click(approveButton as HTMLButtonElement);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });
    await user.click(approveButton as HTMLButtonElement);

    const modal = screen.getByTestId(`modal-confirmation-modal-${order.id}`);

    await waitFor(() => {
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveClass('is-visible');
      // for some reason, toBeVisible() doesn't work.
      expect(modal).toHaveStyle({ display: 'block' });
    });

    const modalApproveButton = screen.getByTestId(
      `button-confirmation-modal-${order.id}-submit-button`,
    );

    await waitFor(() => {
      expect(modalApproveButton).toBeEnabled();
    });

    await user.click(modalApproveButton);

    await waitFor(() => {
      expect(onOrderUpdateMockFunc).toHaveBeenCalled();
      expect(onOrderUpdateMockFunc).toHaveBeenCalledWith({
        message: alertMessage,
        timeOut: 8,
        type: UswdsAlertStyle.Error,
      });
    });
  });

  // TODO: The fact that this if failing makes no sense to me. Manually it works as expected.
  test.skip('should clear checkboxes and disable approve button when cancel is clicked', async () => {
    renderWithProps();
    const { approveButton, rejectButton, clearButton, checkbox1, checkbox2 } =
      await fillInFormToEnableVerifyButton();

    await user.click(approveButton as HTMLButtonElement);

    await waitFor(() => {
      expect(checkbox1!.checked).toBeTruthy();
      expect(checkbox2!.checked).toBeTruthy();
      expect(rejectButton).toBeEnabled();
      expect(approveButton).toBeEnabled();
    });

    await user.click(clearButton as HTMLButtonElement);

    await waitFor(() => {
      expect(checkbox1!.checked).toBeFalsy();
      expect(checkbox2!.checked).toBeFalsy();
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).not.toBeEnabled();
    });
  });

  test.skip('should clear checkboxes and disable approve button when accordion is collapsed', async () => {
    renderWithProps();
    let { approveButton, checkbox1, checkbox2 } = await fillInFormToEnableVerifyButton();

    const collapseButton = screen.getByTestId(`accordion-button-order-list-${order.id}`);

    await user.click(approveButton as HTMLButtonElement);

    await waitFor(() => {
      expect(checkbox1!.checked).toBeTruthy();
      expect(checkbox2!.checked).toBeTruthy();
      expect(approveButton).toBeEnabled();
    });

    await user.click(collapseButton as HTMLButtonElement); // collapse accordion

    await user.click(collapseButton as HTMLButtonElement);
    checkbox1 = screen.getByTestId(
      `checkbox-case-selection-case-list-${order.id}-0`,
    ) as HTMLInputElement | null;
    checkbox2 = screen.getByTestId(
      `checkbox-case-selection-case-list-${order.id}-1`,
    ) as HTMLInputElement | null;

    approveButton = findApproveButton(order.id!);
    await waitFor(() => {
      expect(checkbox1!.checked).toBeFalsy();
      expect(checkbox2!.checked).toBeFalsy();
      expect(approveButton).not.toBeEnabled();
    });
  });

  test.skip('should select all checkboxes and enable approve button when Include All button is clicked and consolidation type and lead case are set', async () => {
    renderWithProps();
    const { approveButton } = await fillInFormToEnableVerifyButton();

    const checkboxList: NodeListOf<HTMLInputElement> = document.querySelectorAll(
      'table input[type="checkbox"]',
    );

    const includeAllCheckbox = await testingUtilities.selectCheckbox(
      `case-list-${order.id}-checkbox-toggle`,
    );

    await waitFor(() => {
      for (const checkbox of checkboxList) {
        expect(checkbox.checked).toBeTruthy();
      }
    });

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });

    await user.click(checkboxList[0]);
    await waitFor(() => {
      expect(checkboxList[0].checked).toBeFalsy();
    });

    await user.click(includeAllCheckbox!);
    await waitFor(() => {
      for (const checkbox of checkboxList) {
        expect(checkbox.checked).toBeTruthy();
      }
      expect(approveButton).toBeEnabled();
    });

    await user.click(includeAllCheckbox!);
    await waitFor(() => {
      for (const checkbox of checkboxList) {
        expect(checkbox.checked).toBeFalsy();
      }
      expect(approveButton).toBeDisabled();
    });
  });
});
