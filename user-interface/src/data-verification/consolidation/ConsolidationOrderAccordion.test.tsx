import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

//TODO: update testss with new combobox implementation

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

function openAccordion(orderId: string) {
  const header: HTMLElement = screen.getByTestId(`accordion-heading-${orderId}`);
  fireEvent.click(header);
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

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
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

  function renderWithProps(props?: Partial<ConsolidationOrderAccordionProps>) {
    const defaultProps: ConsolidationOrderAccordionProps = {
      order,
      courts: offices,
      orderType,
      statusType: orderStatusType,
      onOrderUpdate: onOrderUpdateMockFunc,
      onExpand: onExpandMockFunc,
      regionsMap: regionMap,
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <BrowserRouter>
        <ConsolidationOrderAccordion {...renderProps} />
      </BrowserRouter>,
    );
  }

  function clickMarkLeadButton(index: number) {
    const markAsLeadButton = screen.getByTestId(
      `button-assign-lead-case-list-${order.id}-${index}`,
    );
    if (markAsLeadButton.classList.contains('usa-button--outline')) {
      fireEvent.click(markAsLeadButton);
      expect(markAsLeadButton).not.toHaveClass('usa-button--outline');
    } else {
      fireEvent.click(markAsLeadButton);
      expect(markAsLeadButton).toHaveClass('usa-button--outline');
    }
  }

  function selectTypeAndMarkLead() {
    const consolidationTypeRadio = document.querySelector('input[name="consolidation-type"]');
    const consolidationTypeRadioLabel = document.querySelector('.usa-radio__label');
    fireEvent.click(consolidationTypeRadioLabel!);
    expect(consolidationTypeRadio).toBeChecked();

    clickMarkLeadButton(0);
  }

  function clickCaseCheckbox(oid: string, idx: number) {
    return testingUtilities.selectCheckbox(
      `case-selection-case-list-${oid}-${idx}`,
    ) as HTMLInputElement | null;
  }

  function findCaseNumberInput(id: string) {
    const caseIdInput = document.querySelector(`input#lead-case-input-${id}`);
    expect(caseIdInput).toBeInTheDocument();
    return caseIdInput;
  }

  function enterCaseNumber(caseIdInput: Element | null | undefined, value: string) {
    if (!caseIdInput) throw Error();

    fireEvent.change(caseIdInput!, { target: { value } });
  }

  function findApproveButton(id: string) {
    return document.querySelector(`#accordion-approve-button-${id}`);
  }

  function findRejectButton(id: string) {
    return document.querySelector(`#accordion-reject-button-${id}`);
  }

  function findValidCaseNumberTable(id: string) {
    return screen.queryByTestId(`valid-case-number-found-${id}`);
  }

  function findValidCaseNumberAlert(id: string) {
    return screen.queryByTestId(`alert-container-lead-case-number-alert-${id}`);
  }

  async function toggleEnableCaseListForm(id: string) {
    const caseNumberToggleCheckbox = screen.getByTestId(
      `checkbox-lead-case-form-checkbox-toggle-${id}`,
    );

    const initialValue = (caseNumberToggleCheckbox as HTMLInputElement).checked;

    const caseNumberToggleCheckboxButton = screen.getByTestId(
      `button-checkbox-lead-case-form-checkbox-toggle-${id}-click-target`,
    );
    fireEvent.click(caseNumberToggleCheckboxButton);

    if (initialValue) {
      await waitFor(() => {
        expect(caseNumberToggleCheckbox).not.toBeChecked();
      });
    } else {
      await waitFor(() => {
        expect(caseNumberToggleCheckbox).toBeChecked();
      });
    }
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

  test.skip('should correctly enable/disable buttons when selecting consolidated cases and lead case from order case list table', async () => {
    renderWithProps();
    openAccordion(order.id!);
    // setupApiGetMock({ bCase: order.childCases[0] });
    // vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({ data: order.childCases[0] });

    const includeAllCheckbox = document.querySelector(`.checkbox-toggle label button`);
    const approveButton = findApproveButton(order.id!);
    const rejectButton = findRejectButton(order.id!);

    selectTypeAndMarkLead();

    expect(approveButton).not.toBeEnabled();
    expect(rejectButton).not.toBeEnabled();

    const firstCheckbox = clickCaseCheckbox(order.id!, 0);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    const secondCheckbox = clickCaseCheckbox(order.id!, 1);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    clickMarkLeadButton(0);
    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    clickMarkLeadButton(0);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    fireEvent.click(firstCheckbox!);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    fireEvent.click(secondCheckbox!);
    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).not.toBeEnabled();
    });

    fireEvent.click(includeAllCheckbox!);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    fireEvent.click(includeAllCheckbox!);
    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).not.toBeEnabled();
    });

    fireEvent.click(firstCheckbox!);
    fireEvent.click(secondCheckbox!);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });
  });

  test.skip('should correctly enable/disable buttons based on selections in "case not listed" form', async () => {
    renderWithProps();
    openAccordion(order.id!);
    // setupApiGetMock({ bCase: order.childCases[0] });

    const includeAllCheckbox = document.querySelector(`.checkbox-toggle label button`);
    const approveButton = findApproveButton(order.id!);
    const rejectButton = findRejectButton(order.id!);

    selectTypeAndMarkLead();
    fireEvent.click(includeAllCheckbox!);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    const markAsLeadButton = screen.getByTestId(`button-assign-lead-case-list-${order.id}-0`);
    expect(markAsLeadButton).not.toHaveClass('usa-button--outline');

    await toggleEnableCaseListForm(order.id!);

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).toBeEnabled();
      expect(markAsLeadButton).toHaveClass('usa-button--outline');
    });

    testingUtilities.selectComboBoxItem(`lead-case-court`, 0);

    const caseNumberInput = findCaseNumberInput(order.id!);

    const validCaseNumber = getCaseNumber(order.childCases[0].caseId).replace('-', '');
    enterCaseNumber(caseNumberInput, validCaseNumber);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    enterCaseNumber(caseNumberInput, '11111111');

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    enterCaseNumber(caseNumberInput, '111111');

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    testingUtilities.selectComboBoxItem(`lead-case-court`, 0);
    enterCaseNumber(caseNumberInput, validCaseNumber);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    const leadCaseForm = document.querySelector(`.lead-case-form-container-${order.id}`);
    expect(leadCaseForm).toBeInTheDocument();

    await toggleEnableCaseListForm(order.id!);

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).toBeEnabled();
      expect(leadCaseForm).not.toBeInTheDocument();
    });
  });

  test.skip('should show alert when no lead case can be found in search field, and case table when search finds a matching value', async () => {
    renderWithProps();
    openAccordion(order.id!);
    // setupApiGetMock({ bCase: order.childCases[0] });

    await toggleEnableCaseListForm(order.id!);

    testingUtilities.selectComboBoxItem(`lead-case-court`, 0);
    const caseNumberInput = findCaseNumberInput(order.id!);

    enterCaseNumber(caseNumberInput, '11111111');

    await waitFor(() => {
      const alert = findValidCaseNumberAlert(order.id!);
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent("We couldn't find a case with that number.");
      expect(findValidCaseNumberTable(order.id!)).not.toBeInTheDocument();
    });

    enterCaseNumber(caseNumberInput, '11111');

    await waitFor(() => {
      expect(findValidCaseNumberAlert(order.id!)).not.toBeInTheDocument();
      expect(findValidCaseNumberTable(order.id!)).not.toBeInTheDocument();
    });

    testingUtilities.selectComboBoxItem(`lead-case-court`, 0);
    enterCaseNumber(caseNumberInput, getCaseNumber(order.childCases[0].caseId).replace('-', ''));

    await waitFor(() => {
      expect(findValidCaseNumberAlert(order.id!)).not.toBeInTheDocument();
      expect(findValidCaseNumberTable(order.id!)).toBeInTheDocument();
    });

    enterCaseNumber(caseNumberInput, '');

    await waitFor(() => {
      expect(findValidCaseNumberAlert(order.id!)).not.toBeInTheDocument();
      expect(findValidCaseNumberTable(order.id!)).not.toBeInTheDocument();
    });
  });

  test.skip('should show alert when no lead case can be found in search field, and error returned was not a 404', async () => {
    renderWithProps();
    openAccordion(order.id!);
    // setupApiGetMock({ bCase: order.childCases[0] });

    await toggleEnableCaseListForm(order.id!);

    testingUtilities.selectComboBoxItem(`lead-case-court`, 0);
    const caseNumberInput = findCaseNumberInput(order.id!);

    enterCaseNumber(caseNumberInput, '00000000');

    await waitFor(() => {
      const alert = findValidCaseNumberAlert(order.id!);
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Cannot verify lead case number.');
      expect(findValidCaseNumberTable(order.id!)).not.toBeInTheDocument();
    });
  });

  test.skip('should show alert when lookup of associated cases fails', async () => {
    renderWithProps();
    openAccordion(order.id!);
    const testCase = { ...order.childCases[0] };
    testCase.caseId = '999-99-99999';

    await toggleEnableCaseListForm(order.id!);

    testingUtilities.selectComboBoxItem('lead-case-court', 0);

    const caseNumberInput = findCaseNumberInput(order.id!);

    enterCaseNumber(caseNumberInput, '9900001');
    // const alertContainer = document.querySelector('.usa-alert-container');
    // screen.debug(alertContainer!);

    await waitFor(() => {
      // TODO: Figure out why this never changes from the loading spinner... still waiting for result.
      // screen.debug(document.querySelector('.lead-case-number-container')!);

      const alert = findValidCaseNumberAlert(order.id!);
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(
        `Cannot verify lead case is not part of another consolidation. `,
      );
      expect(findValidCaseNumberTable(order.id!)).not.toBeInTheDocument();
    });
  });

  test.skip('should open approval modal when approve button is clicked', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const approveButton = document.querySelector(
      `#accordion-approve-button-${order.id}`,
    ) as HTMLButtonElement;
    expect(approveButton).not.toBeEnabled();

    selectTypeAndMarkLead();

    clickCaseCheckbox(order.id!, 0);
    clickCaseCheckbox(order.id!, 1);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });

    fireEvent.click(approveButton);

    const modal = screen.getByTestId(`modal-confirmation-modal-${order.id}`);
    await waitFor(() => {
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveClass('is-visible');
      // for some reason, toBeVisible() doesn't work.
      expect(modal).toHaveStyle({ display: 'block' });
    });
  });

  test('should open rejection modal when reject button is clicked', async () => {
    renderWithProps();
    const rejectButton = document.querySelector(
      `#accordion-reject-button-${order.id}`,
    ) as HTMLButtonElement;
    expect(rejectButton).not.toBeEnabled();

    selectTypeAndMarkLead();

    clickCaseCheckbox(order.id!, 0);
    await waitFor(() => {
      expect(rejectButton).toBeEnabled();
    });

    fireEvent.click(rejectButton);

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

    selectTypeAndMarkLead();

    await waitFor(() => {
      expect(rejectButton).toBeEnabled();
    });
    fireEvent.click(rejectButton);

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

    fireEvent.click(modalRejectButton);

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

    selectTypeAndMarkLead();

    await waitFor(() => {
      expect(rejectButton).toBeEnabled();
    });
    fireEvent.click(rejectButton);

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

    fireEvent.click(modalRejectButton);

    await waitFor(() => {
      expect(onOrderUpdateMockFunc).toHaveBeenCalled();
      expect(onOrderUpdateMockFunc).toHaveBeenCalledWith({
        message: alertMessage,
        timeOut: 8,
        type: UswdsAlertStyle.Error,
      });
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
      data: MockData.buildArray(MockData.getCaseBasics, 5),
    });

    renderWithProps();
    openAccordion(order.id!);

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    expect(approveButton).not.toBeEnabled();

    clickCaseCheckbox(order.id!, 0);
    clickCaseCheckbox(order.id!, 1);

    selectTypeAndMarkLead();

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(approveButton as HTMLButtonElement);

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

    fireEvent.click(modalApproveButton);

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
    openAccordion(order.id!);

    // setupApiGetMock();

    const errorMessage = 'Some random error';
    const alertMessage =
      'An unknown error has occurred and has been logged.  Please try again later.';
    vi.spyOn(Api2, 'putConsolidationOrderApproval').mockRejectedValue(new Error(errorMessage));

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    expect(approveButton).not.toBeEnabled();

    clickCaseCheckbox(order.id!, 0);
    clickCaseCheckbox(order.id!, 1);

    selectTypeAndMarkLead();

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(approveButton as HTMLButtonElement);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(approveButton as HTMLButtonElement);

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

    fireEvent.click(modalApproveButton);

    await waitFor(() => {
      expect(onOrderUpdateMockFunc).toHaveBeenCalled();
      expect(onOrderUpdateMockFunc).toHaveBeenCalledWith({
        message: alertMessage,
        timeOut: 8,
        type: UswdsAlertStyle.Error,
      });
    });
  });

  test.skip('should clear checkboxes and disable approve button when cancel is clicked', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    const rejectButton = document.querySelector(`#accordion-reject-button-${order.id}`);
    const cancelButton = document.querySelector(`#accordion-cancel-button-${order.id}`);
    expect(approveButton).not.toBeEnabled();
    expect(rejectButton).not.toBeEnabled();

    const checkbox1: HTMLInputElement | null = clickCaseCheckbox(order.id!, 0);
    const checkbox2: HTMLInputElement | null = clickCaseCheckbox(order.id!, 1);

    expect(approveButton).not.toBeEnabled();

    selectTypeAndMarkLead();

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });
    fireEvent.click(approveButton as HTMLButtonElement);

    await waitFor(() => {
      expect(checkbox1!.checked).toBeTruthy();
      expect(checkbox2!.checked).toBeTruthy();
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    fireEvent.click(cancelButton as HTMLButtonElement);

    await waitFor(() => {
      expect(checkbox1!.checked).toBeFalsy();
      expect(checkbox2!.checked).toBeFalsy();
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).not.toBeEnabled();
    });
  });

  test.skip('should clear checkboxes and disable approve button when accordion is collapsed', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    const collapseButton = screen.getByTestId(`accordion-button-order-list-${order.id}`);
    expect(approveButton).not.toBeEnabled();

    let checkbox1: HTMLInputElement | null = clickCaseCheckbox(order.id!, 0);
    let checkbox2: HTMLInputElement | null = clickCaseCheckbox(order.id!, 1);

    selectTypeAndMarkLead();

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(approveButton as HTMLButtonElement);

    await waitFor(() => {
      expect(checkbox1!.checked).toBeTruthy();
      expect(checkbox2!.checked).toBeTruthy();
      expect(approveButton).toBeEnabled();
    });

    fireEvent.click(collapseButton as HTMLButtonElement); // collapse accordion

    fireEvent.click(collapseButton as HTMLButtonElement);
    checkbox1 = screen.getByTestId(
      `checkbox-case-selection-case-list-${order.id}-0`,
    ) as HTMLInputElement | null;
    checkbox2 = screen.getByTestId(
      `checkbox-case-selection-case-list-${order.id}-1`,
    ) as HTMLInputElement | null;

    await waitFor(() => {
      expect(checkbox1!.checked).toBeFalsy();
      expect(checkbox2!.checked).toBeFalsy();
      expect(approveButton).not.toBeEnabled();
    });
  });

  test.skip('should select all checkboxes and enable approve button when Include All button is clicked and consolidation type and lead case are set', async () => {
    renderWithProps();
    openAccordion(order.id!);
    // setupApiGetMock();

    selectTypeAndMarkLead();

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    expect(approveButton).not.toBeEnabled();

    const checkboxList: NodeListOf<HTMLInputElement> = document.querySelectorAll(
      'table input[type="checkbox"]',
    );

    const includeAllButton = testingUtilities.selectCheckbox(
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

    fireEvent.click(checkboxList[0]);
    await waitFor(() => {
      expect(checkboxList[0].checked).toBeFalsy();
    });

    fireEvent.click(includeAllButton!);
    await waitFor(() => {
      for (const checkbox of checkboxList) {
        expect(checkbox.checked).toBeTruthy();
      }
      expect(approveButton).toBeEnabled();
    });

    fireEvent.click(includeAllButton!);
    await waitFor(() => {
      for (const checkbox of checkboxList) {
        expect(checkbox.checked).toBeFalsy();
      }
      expect(approveButton).toBeDisabled();
    });
  });

  test('checking "lead case not listed" checkbox should clear markLeadCase button selection', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const leadCaseFormCheckbox = screen.getByTestId(
      `checkbox-lead-case-form-checkbox-toggle-${order.id}`,
    );
    expect(leadCaseFormCheckbox).not.toBeChecked();

    const markLeadCaseButton = screen.getByTestId(`button-assign-lead-case-list-${order.id}-0`);
    expect(markLeadCaseButton).toHaveClass('usa-button--outline');

    fireEvent.click(markLeadCaseButton);
    expect(markLeadCaseButton).not.toHaveClass('usa-button--outline');

    fireEvent.click(leadCaseFormCheckbox);

    waitFor(() => {
      expect(markLeadCaseButton).toHaveClass('usa-button--outline');
    });
  });
});
