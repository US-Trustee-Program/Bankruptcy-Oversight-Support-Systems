import { render, screen, waitFor } from '@testing-library/react';
import { taskType, orderStatusType } from '@/lib/utils/labels';
import { BrowserRouter } from 'react-router-dom';
import { ConsolidationOrder } from '@common/cams/orders';
import {
  ConsolidationOrderAccordion,
  ConsolidationOrderAccordionProps,
} from '@/data-verification/consolidation/ConsolidationOrderAccordion';
import MockData from '@common/cams/test-utilities/mock-data';
import { CourtDivisionDetails } from '@common/cams/courts';
import { formatDate } from '@/lib/utils/datetime';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { getCaseNumber } from '@common/cams/cases';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { FeatureFlagSet } from '@common/feature-flags';
import Api2 from '@/lib/models/api2';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { AccordionGroup } from '@/lib/components/uswds/Accordion';

const userEvent = TestingUtilities.setupUserEvent();

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

async function openAccordion(orderId: string) {
  const header: HTMLElement = screen.getByTestId(`accordion-heading-${orderId}`);
  await userEvent.click(header);
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
  let userEvent: CamsUserEvent;

  beforeEach(async () => {
    // Restore/unstub here (start of beforeEach), not in afterEach — a failing test skips
    // afterEach, which would leak un-restored spies/stubs into the next test's setup.
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');

    mockFeatureFlags = {
      'consolidations-enabled': true,
    };
    userEvent = TestingUtilities.setupUserEvent();

    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
    vi.spyOn(Api2, 'getCaseAssignments').mockResolvedValue({
      data: MockData.buildArray(MockData.getAttorneyAssignment, 2),
    });
    vi.spyOn(Api2, 'getCaseAssociations').mockRejectedValue(
      '404 Case associations not found for the case ID.',
    );
    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({ data: MockData.getCaseSummary() });
  });

  const accordionFieldHeaders = ['Court District', 'Order Filed', 'Task Type', 'Task Status'];

  function renderWithProps(props?: Partial<ConsolidationOrderAccordionProps>) {
    const defaultProps: ConsolidationOrderAccordionProps = {
      order,
      courts: offices,
      taskType,
      statusType: orderStatusType,
      onOrderUpdate: onOrderUpdateMockFunc,
      onExpand: onExpandMockFunc,
      regionsMap: regionMap,
      fieldHeaders: accordionFieldHeaders,
    };

    const renderProps = { ...defaultProps, ...props };
    return render(
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
    await userEvent.click(markAsLeadButton);
    expect(markAsLeadButton.getAttribute('aria-checked')).toEqual('true');
    return markAsLeadButton;
  }

  async function clearLeadCase(index: number) {
    const markAsLeadButton = screen.getByTestId(
      `button-assign-lead-case-list-${order.id}-${index}`,
    );
    expect(markAsLeadButton).not.toBeNull();
    expect(markAsLeadButton.getAttribute('aria-checked')).toEqual('true');
    await userEvent.click(markAsLeadButton);
    expect(markAsLeadButton.getAttribute('aria-checked')).not.toEqual('true');
  }

  async function selectConsolidationType() {
    const consolidationTypeRadio = document.querySelector('input[name="consolidation-type"]');
    const consolidationTypeRadioLabel = document.querySelector('.usa-radio__label');
    expect(consolidationTypeRadioLabel).not.toBeNull();
    if (consolidationTypeRadioLabel) {
      await userEvent.click(consolidationTypeRadioLabel);
    }
    expect(consolidationTypeRadio).toBeChecked();
    return consolidationTypeRadio;
  }

  async function clickCaseCheckbox(oid: string, idx: number) {
    return TestingUtilities.selectCheckbox(
      `case-selection-case-list-${oid}-${idx}`,
    ) as Promise<HTMLInputElement | null>;
  }

  async function fillInFormToEnableVerifyButton() {
    await openAccordion(order.id!);

    const approveButton = findApproveButton(order.id!);
    const rejectButton = findRejectButton(order.id!);
    const clearButton = findClearButton(order.id!);

    expect(rejectButton).not.toBeEnabled();

    const consolidationTypeRadio = await selectConsolidationType();
    const checkbox1 = await clickCaseCheckbox(order.id!, 0);
    const checkbox2 = await clickCaseCheckbox(order.id!, 1);

    expect(approveButton).not.toBeEnabled();

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
    expect(heading?.textContent).toContain(formatDate(order.taskDate));
  });

  test('should display pending order content', () => {
    const pendingOrder = MockData.getConsolidationOrder();
    renderWithProps({ order: pendingOrder });
    findAccordionContent(pendingOrder.id!, false);

    const memberCaseTable = screen.getByTestId(`case-list-${pendingOrder.id}`);
    expect(memberCaseTable).toBeInTheDocument();

    // The per-row content (case title, docket entry summary/full text) is rendered by
    // ConsolidationCasesTable and is covered there. Here we only verify the correct number
    // of member case rows were handed off to that child component.
    pendingOrder.memberCases.forEach((_memberCase, idx) => {
      const tableRow = screen.getByTestId(`case-list-${pendingOrder.id}-row-${idx}-case-info`);
      expect(tableRow).toBeInTheDocument();
    });
  });

  test('should display approved order content', () => {
    const leadCase = MockData.getCaseSummary();
    const order = MockData.getConsolidationOrder({ override: { status: 'approved', leadCase } });
    renderWithProps({ order });

    const leadCaseLink = screen.queryByTestId(`lead-case-number-link`);
    expect(leadCaseLink).toBeInTheDocument();

    // The per-row content (case title) is rendered by CaseTable and is covered there. Here
    // we only verify the correct number of member case rows were handed off to that child
    // component.
    order.memberCases.forEach((_bCase, idx) => {
      const tableRow = screen.queryByTestId(`order-${order.id}-member-cases-row-${idx}`);
      expect(tableRow).toBeInTheDocument();
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

    // The per-row content (case title) is rendered by ConsolidationCasesTable and is covered
    // there. Here we only verify the correct number of member case rows were handed off to
    // that child component.
    order.memberCases.forEach((_bCase, idx) => {
      const tableRow = screen.queryByTestId(`${order.id}-case-list-row-${idx}-case-info`);
      expect(tableRow).toBeInTheDocument();
    });
  });

  test('should open rejection modal when reject button is clicked', async () => {
    renderWithProps();
    const rejectButton = document.querySelector(
      `#accordion-reject-button-${order.id}`,
    ) as HTMLButtonElement;
    expect(rejectButton).not.toBeEnabled();

    await selectConsolidationType();

    await clickCaseCheckbox(order.id!, 0);
    await waitFor(() => {
      expect(rejectButton).toBeEnabled();
    });

    await userEvent.click(rejectButton);

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

    await clickCaseCheckbox(order.id!, 0);

    await selectConsolidationType();

    await waitFor(() => {
      expect(rejectButton).toBeEnabled();
    });
    await userEvent.click(rejectButton);

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

    await userEvent.click(modalRejectButton);

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

    await clickCaseCheckbox(order.id!, 0);

    await selectConsolidationType();

    await waitFor(() => {
      expect(rejectButton).toBeEnabled();
    });
    await userEvent.click(rejectButton);

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

    await userEvent.click(modalRejectButton);

    await waitFor(() => {
      expect(onOrderUpdateMockFunc).toHaveBeenCalled();
      expect(onOrderUpdateMockFunc).toHaveBeenCalledWith({
        message: alertMessage,
        timeOut: 8,
        type: UswdsAlertStyle.Error,
      });
    });
  });

  test('disables both approve and reject buttons before any case or lead case is selected', async () => {
    vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue({
      data: [],
    });
    renderWithProps();

    await waitFor(() => {
      expect(findApproveButton(order.id!)).toBeDisabled();
    });
    expect(findRejectButton(order.id!)).toBeDisabled();
  });

  test('disables approve button but not reject button when only the lead case remains selected', async () => {
    vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue({
      data: [],
    });
    renderWithProps();
    const { approveButton, rejectButton } = await fillInFormToEnableVerifyButton();

    await clickCaseCheckbox(order.id!, 1);

    await waitFor(() => {
      expect(approveButton).toBeDisabled();
    });
    expect(rejectButton).toBeEnabled();
  });

  test('keeps approve button disabled after clearing the lead case while a case is still selected', async () => {
    vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue({
      data: [],
    });
    renderWithProps();
    const { approveButton, rejectButton } = await fillInFormToEnableVerifyButton();

    await clickCaseCheckbox(order.id!, 1);
    await waitFor(() => {
      expect(approveButton).toBeDisabled();
    });

    await clearLeadCase(0);

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
    });
    expect(rejectButton).toBeEnabled();
  });

  test('disables approve button again after re-marking the lead case on a single selected case', async () => {
    vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue({
      data: [],
    });
    renderWithProps();
    const { approveButton, rejectButton } = await fillInFormToEnableVerifyButton();

    await clickCaseCheckbox(order.id!, 1);
    await clearLeadCase(0);

    await setLeadCase(0);

    await waitFor(() => {
      expect(approveButton).toBeDisabled();
    });
    expect(rejectButton).toBeEnabled();
  });

  test('disables both approve and reject buttons when all cases are deselected', async () => {
    vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue({
      data: [],
    });
    renderWithProps();
    const { approveButton, rejectButton } = await fillInFormToEnableVerifyButton();

    await clickCaseCheckbox(order.id!, 1);
    await clickCaseCheckbox(order.id!, 0);

    await waitFor(() => {
      expect(rejectButton).not.toBeEnabled();
    });
    expect(approveButton).not.toBeEnabled();
  });

  test('disables both approve and reject buttons when Include All checkbox is toggled off', async () => {
    vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue({
      data: [],
    });
    renderWithProps();
    const { approveButton, rejectButton } = await fillInFormToEnableVerifyButton();
    const includeAllCheckbox = document.querySelector(
      `#checkbox-case-list-${order.id}-checkbox-toggle-click-target`,
    );

    await userEvent.click(includeAllCheckbox!);

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
    });
    expect(rejectButton).not.toBeEnabled();
  });

  test('re-enables both approve and reject buttons when cases are individually reselected after clearing', async () => {
    vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue({
      data: [],
    });
    renderWithProps();
    const { approveButton, rejectButton } = await fillInFormToEnableVerifyButton();

    await clickCaseCheckbox(order.id!, 1);
    await clickCaseCheckbox(order.id!, 0);

    await clickCaseCheckbox(order.id!, 0);
    await clickCaseCheckbox(order.id!, 1);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });
    expect(rejectButton).toBeEnabled();
  });

  test('should open approval modal when approve button is clicked', async () => {
    vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue({
      data: [],
    });
    renderWithProps();
    const { approveButton } = await fillInFormToEnableVerifyButton();

    await userEvent.click(approveButton!);

    const modal = screen.getByTestId(`modal-confirmation-modal-${order.id}`);
    await waitFor(() => {
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveClass('is-visible');
      // for some reason, toBeVisible() doesn't work.
      expect(modal).toHaveStyle({ display: 'block' });
    });
  });

  test('should call orderUpdate for approval', async () => {
    const leadCase = order.memberCases[0];
    const expectedOrderApproved: ConsolidationOrder = {
      ...order,
      leadCase,
      status: 'approved',
    };
    vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue({
      data: [],
    });
    vi.spyOn(Api2, 'putConsolidationOrderApproval').mockResolvedValue({
      data: [expectedOrderApproved],
    });

    renderWithProps();
    const { approveButton } = await fillInFormToEnableVerifyButton();
    await userEvent.click(approveButton as HTMLButtonElement);

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

    await userEvent.click(modalApproveButton);

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

  test('should handle api exception for approval', async () => {
    vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue({
      data: [],
    });
    const errorMessage = 'Some random error';
    vi.spyOn(Api2, 'putConsolidationOrderApproval').mockRejectedValue(new Error(errorMessage));
    renderWithProps();

    const alertMessage =
      'An unknown error has occurred and has been logged.  Please try again later.';

    const { approveButton } = await fillInFormToEnableVerifyButton();

    await userEvent.click(approveButton as HTMLButtonElement);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });
    await userEvent.click(approveButton as HTMLButtonElement);

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

    await userEvent.click(modalApproveButton);

    await waitFor(() => {
      expect(onOrderUpdateMockFunc).toHaveBeenCalled();
      expect(onOrderUpdateMockFunc).toHaveBeenCalledWith({
        message: alertMessage,
        timeOut: 8,
        type: UswdsAlertStyle.Error,
      });
    });
  });

  test('should clear checkboxes and disable approve button when cancel is clicked', async () => {
    vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue({
      data: [],
    });
    renderWithProps();
    const { approveButton, rejectButton, clearButton, checkbox1, checkbox2 } =
      await fillInFormToEnableVerifyButton();

    await userEvent.click(approveButton as HTMLButtonElement);

    await waitFor(() => {
      expect(checkbox1!.checked).toBeTruthy();
      expect(checkbox2!.checked).toBeTruthy();
      expect(rejectButton).toBeEnabled();
      expect(approveButton).toBeEnabled();
    });

    await userEvent.click(clearButton as HTMLButtonElement);

    await waitFor(() => {
      expect(checkbox1!.checked).toBeFalsy();
      expect(checkbox2!.checked).toBeFalsy();
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).not.toBeEnabled();
    });
  });

  test('should clear checkboxes and disable approve button when accordion is collapsed', async () => {
    vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue({
      data: [],
    });
    renderWithProps();
    let { approveButton, checkbox1, checkbox2 } = await fillInFormToEnableVerifyButton();

    const collapseButton = screen.getByTestId(`accordion-button-order-list-${order.id}`);

    await userEvent.click(approveButton as HTMLButtonElement);

    await waitFor(() => {
      expect(checkbox1!.checked).toBeTruthy();
      expect(checkbox2!.checked).toBeTruthy();
      expect(approveButton).toBeEnabled();
    });

    await userEvent.click(collapseButton as HTMLButtonElement); // collapse accordion

    await userEvent.click(collapseButton as HTMLButtonElement);
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

  test('should select all checkboxes and enable approve button when Include All button is clicked and consolidation type and lead case are set', async () => {
    vi.spyOn(Api2, 'getCaseAssociations').mockResolvedValue({
      data: [],
    });
    renderWithProps();
    const { approveButton } = await fillInFormToEnableVerifyButton();

    const checkboxList: NodeListOf<HTMLInputElement> = document.querySelectorAll(
      'table input[type="checkbox"]',
    );

    await waitFor(() => {
      for (const checkbox of checkboxList) {
        expect(checkbox.checked).toBeTruthy();
      }
      expect(approveButton).toBeEnabled();
    });

    const includeAllCheckbox = document.querySelector(
      `#checkbox-case-list-${order.id}-checkbox-toggle-click-target`,
    );
    await userEvent.click(includeAllCheckbox!);

    await waitFor(() => {
      for (const checkbox of checkboxList) {
        expect(checkbox.checked).toBeFalsy();
      }
      expect(approveButton).toBeDisabled();
    });

    await userEvent.click(includeAllCheckbox!);
    await waitFor(() => {
      for (const checkbox of checkboxList) {
        expect(checkbox.checked).toBeTruthy();
      }
      expect(approveButton).toBeEnabled();
    });
  });

  test('should call onExpand with the accordion id when the accordion is expanded', async () => {
    renderWithProps();

    await openAccordion(order.id!);

    expect(onExpandMockFunc).toHaveBeenCalledWith(`order-list-${order.id}`);
  });

  test('should render without throwing when getCaseAssignments fails for a member case', async () => {
    vi.spyOn(Api2, 'getCaseAssignments').mockRejectedValue(new Error('assignment lookup failed'));
    renderWithProps();

    await openAccordion(order.id!);

    await waitFor(() => {
      const memberCaseTable = screen.getByTestId(`case-list-${order.id}`);
      expect(memberCaseTable).toBeInTheDocument();
    });
  });

  test('should hide the accordion heading when hidden prop is true', () => {
    renderWithProps({ hidden: true });

    const heading = screen.getByTestId(`accordion-order-list-${order.id}`);
    expect(heading).toHaveAttribute('hidden');
  });

  test('should render content expanded when expandedId prop matches the order', () => {
    renderWithProps({ expandedId: `order-list-${order.id}` });

    findAccordionContent(order.id!, true);
  });

  test('toggles closed when the header is clicked a second time inside an AccordionGroup', async () => {
    render(
      <BrowserRouter>
        <AccordionGroup>
          <ConsolidationOrderAccordion
            order={order}
            courts={offices}
            taskType={taskType}
            statusType={orderStatusType}
            onOrderUpdate={onOrderUpdateMockFunc}
            regionsMap={regionMap}
            fieldHeaders={accordionFieldHeaders}
          />
        </AccordionGroup>
      </BrowserRouter>,
    );

    const heading = findAccordionHeading(order.id!);

    await userEvent.click(heading);
    findAccordionContent(order.id!, true);

    await userEvent.click(heading);
    findAccordionContent(order.id!, false);
  });
});
