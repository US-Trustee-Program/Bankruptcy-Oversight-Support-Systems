import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { orderType, orderStatusType } from '@/lib/utils/labels';
import { BrowserRouter } from 'react-router-dom';
import { ConsolidationOrder } from '@common/cams/orders';
import {
  ConsolidationOrderAccordion,
  ConsolidationOrderAccordionProps,
  fetchLeadCaseAttorneys,
} from '@/data-verification/ConsolidationOrderAccordion';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { OfficeDetails } from '@common/cams/courts';
import { formatDate } from '@/lib/utils/datetime';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { FeatureFlagSet } from '@common/feature-flags';
import { SimpleResponseData } from '@/lib/type-declarations/api';
import { CaseAssignment } from '@common/cams/assignments';
import { Consolidation, ConsolidationFrom, ConsolidationTo } from '@common/cams/events';
import { CaseSummary } from '@common/cams/cases';
import { selectItemInMockSelect } from '../lib/components/CamsSelect.mock';

vi.mock('../lib/components/CamsSelect', () => import('../lib/components/CamsSelect.mock'));

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

type ConsolidationArray = (ConsolidationTo | ConsolidationFrom)[];

function setupApiGetMock(options: { bCase?: CaseSummary; associations?: ConsolidationArray } = {}) {
  // Assigned attorneys and associated cases.
  vi.spyOn(Chapter15MockApi, 'get').mockImplementation((path: string) => {
    if (path.includes('/case-assignments/')) {
      return Promise.resolve({
        success: true,
        message: '',
        count: 1,
        body: [MockData.getAttorneyAssignment()],
      } as SimpleResponseData<CaseAssignment[]>);
    } else if (path.match(/\/cases\/\d\d\d-99-99999\/associated/)) {
      return Promise.reject({ message: '404 Case associations not found for the case ID.' });
    } else if (path.includes('/associated')) {
      return Promise.resolve({
        success: true,
        message: '',
        count: 0,
        body: options.associations ?? [],
      } as SimpleResponseData<Consolidation[]>);
    } else if (path.match(/\/cases\/\d\d\d-11-11111\/summary/i)) {
      return Promise.reject({ message: '404 Case summary not found for the case ID.' });
    } else if (path.match(/\/cases\/[A-Z\d-]+\/summary/i)) {
      return Promise.resolve({
        success: true,
        message: '',
        count: 1,
        body: options.bCase ?? {},
      } as SimpleResponseData<CaseSummary>);
    }
    return Promise.resolve({
      success: false,
      body: {},
    });
  });
}

describe('ConsolidationOrderAccordion tests', () => {
  const order: ConsolidationOrder = MockData.getConsolidationOrder();
  const offices: OfficeDetails[] = MockData.getOffices();
  const regionMap = new Map();

  const onOrderUpdateMockFunc = vitest.fn();
  const onExpandMockFunc = vitest.fn();
  let mockFeatureFlags: FeatureFlagSet;

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    mockFeatureFlags = {
      'consolidations-enabled': true,
    };
    vitest.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  function renderWithProps(props?: Partial<ConsolidationOrderAccordionProps>) {
    const defaultProps: ConsolidationOrderAccordionProps = {
      order,
      officesList: offices,
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
    const markAsLeadButton = screen.getByTestId(`button-assign-lead-${index}`);
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

    const caseNumberToggleCheckboxLabel = screen.getByTestId(
      `checkbox-label-lead-case-form-checkbox-toggle-${id}`,
    );
    fireEvent.click(caseNumberToggleCheckboxLabel);

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

    const childCaseTable = screen.getByTestId(`${pendingOrder.id}-case-list`);
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

  test('should correctly enable/disable buttons', async () => {
    renderWithProps();
    openAccordion(order.id!);
    setupApiGetMock({ bCase: order.childCases[0] });

    const firstCheckbox: HTMLInputElement = screen.getByTestId(
      `checkbox-case-selection-${order.id}-case-list-0`,
    );

    const includeAllCheckbox = document.querySelector(`.checkbox-toggle label`);
    const approveButton = findApproveButton(order.id!);
    const rejectButton = findRejectButton(order.id!);

    selectTypeAndMarkLead();

    expect(approveButton).not.toBeEnabled();
    expect(rejectButton).not.toBeEnabled();

    fireEvent.click(firstCheckbox);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    clickMarkLeadButton(0);
    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).not.toBeEnabled();
    });

    clickMarkLeadButton(0);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    fireEvent.click(firstCheckbox);
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

    fireEvent.click(firstCheckbox);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    ///////////// Now testing "case not listed" ///////////////

    const markAsLeadButton = screen.getByTestId('button-assign-lead-0');
    expect(markAsLeadButton).not.toHaveClass('usa-button--outline');

    // selecting "Lead Case Not Listed" should unselect the "MarkAsLead" button

    await toggleEnableCaseListForm(order.id!);

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).not.toBeEnabled();
      expect(markAsLeadButton).toHaveClass('usa-button--outline');
    });

    selectItemInMockSelect(`lead-case-court`, 1);

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
      expect(rejectButton).not.toBeEnabled();
    });

    enterCaseNumber(caseNumberInput, '111111');

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).not.toBeEnabled();
    });

    enterCaseNumber(caseNumberInput, validCaseNumber);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    // unchecking case not listed checkbox should disable buttons
    const leadCaseForm = document.querySelector(`.lead-case-form-container-${order.id}`);
    expect(leadCaseForm).toBeInTheDocument();

    await toggleEnableCaseListForm(order.id!);

    await waitFor(() => {
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).not.toBeEnabled();
      expect(leadCaseForm).not.toBeInTheDocument();
    });
  });

  test('should show alert when no lead case can be found in search field, and case table when search finds a matching value', async () => {
    renderWithProps();
    openAccordion(order.id!);
    setupApiGetMock({ bCase: order.childCases[0] });

    await toggleEnableCaseListForm(order.id!);

    selectItemInMockSelect(`lead-case-court`, 1);
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

  test('should show alert when lookup of associated cases fails', async () => {
    renderWithProps();
    openAccordion(order.id!);
    const testCase = order.childCases[0];
    testCase.caseId = '999-99-99999';
    setupApiGetMock({ bCase: testCase });

    await toggleEnableCaseListForm(order.id!);

    selectItemInMockSelect(`lead-case-court`, 1);
    const caseNumberInput = findCaseNumberInput(order.id!);

    enterCaseNumber(caseNumberInput, '9999999');

    await waitFor(() => {
      const alert = findValidCaseNumberAlert(order.id!);
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(
        `Cannot verify lead case is not part of another consolidation. `,
      );
      expect(findValidCaseNumberTable(order.id!)).not.toBeInTheDocument();
    });
  });

  test('should open approval modal when approve button is clicked', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const approveButton = document.querySelector(
      `#accordion-approve-button-${order.id}`,
    ) as HTMLButtonElement;
    expect(approveButton).not.toBeEnabled();
    const checkbox: HTMLInputElement = screen.getByTestId(
      `checkbox-case-selection-${order.id}-case-list-0`,
    );

    selectTypeAndMarkLead();

    fireEvent.click(checkbox);
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
    const checkbox: HTMLInputElement = screen.getByTestId(
      `checkbox-case-selection-${order.id}-case-list-0`,
    );

    selectTypeAndMarkLead();

    fireEvent.click(checkbox);
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

    vi.spyOn(Chapter15MockApi, 'put').mockResolvedValue({
      message: '',
      count: 1,
      body: [expectedOrderRejected],
    });

    const rejectButton = document.querySelector(
      `#accordion-reject-button-${order.id}`,
    ) as HTMLButtonElement;
    expect(rejectButton).not.toBeEnabled();
    const checkbox: HTMLInputElement = screen.getByTestId(
      `checkbox-case-selection-${order.id}-case-list-0`,
    );
    fireEvent.click(checkbox);

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
    vi.spyOn(Chapter15MockApi, 'put').mockRejectedValue(new Error(errorMessage));

    const rejectButton = document.querySelector(
      `#accordion-reject-button-${order.id}`,
    ) as HTMLButtonElement;
    expect(rejectButton).not.toBeEnabled();
    const checkbox: HTMLInputElement = screen.getByTestId(
      `checkbox-case-selection-${order.id}-case-list-0`,
    );
    fireEvent.click(checkbox);

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

  test('should call orderUpdate for approval', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const leadCase = order.childCases[0];
    const expectedOrderApproved: ConsolidationOrder = {
      ...order,
      leadCase,
      status: 'approved',
    };

    setupApiGetMock();

    vi.spyOn(Chapter15MockApi, 'put').mockResolvedValue({
      message: '',
      count: 1,
      body: [expectedOrderApproved],
    });

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    expect(approveButton).not.toBeEnabled();
    const checkbox: HTMLInputElement = screen.getByTestId(
      `checkbox-case-selection-${order.id}-case-list-0`,
    );
    fireEvent.click(checkbox);

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

  test('should handle api exception for approval', async () => {
    renderWithProps();
    openAccordion(order.id!);

    setupApiGetMock();

    const errorMessage = 'Some random error';
    const alertMessage =
      'An unknown error has occurred and has been logged.  Please try again later.';
    vi.spyOn(Chapter15MockApi, 'put').mockRejectedValue(new Error(errorMessage));

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    expect(approveButton).not.toBeEnabled();
    const checkbox: HTMLInputElement = screen.getByTestId(
      `checkbox-case-selection-${order.id}-case-list-0`,
    );
    fireEvent.click(checkbox);

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

  test('should clear checkboxes and disable approve button when cancel is clicked', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    const cancelButton = document.querySelector(`#accordion-cancel-button-${order.id}`);
    expect(approveButton).not.toBeEnabled();

    const checkbox1: HTMLInputElement = screen.getByTestId(
      `checkbox-case-selection-${order.id}-case-list-0`,
    );
    const checkbox2: HTMLInputElement = screen.getByTestId(
      `checkbox-case-selection-${order.id}-case-list-1`,
    );

    fireEvent.click(checkbox1);
    fireEvent.click(checkbox2);
    expect(approveButton).not.toBeEnabled();

    selectTypeAndMarkLead();

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(approveButton as HTMLButtonElement);

    await waitFor(() => {
      expect(checkbox1.checked).toBeTruthy();
      expect(checkbox2.checked).toBeTruthy();
      expect(approveButton).toBeEnabled();
    });

    fireEvent.click(cancelButton as HTMLButtonElement);

    await waitFor(() => {
      expect(checkbox1.checked).toBeFalsy();
      expect(checkbox2.checked).toBeFalsy();
      expect(approveButton).not.toBeEnabled();
    });
  });

  test('should clear checkboxes and disable approve button when accordion is collapsed', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    const collapseButton = screen.getByTestId(`accordion-button-order-list-${order.id}`);
    expect(approveButton).not.toBeEnabled();

    let checkbox1: HTMLInputElement = screen.getByTestId(
      `checkbox-case-selection-${order.id}-case-list-0`,
    );
    let checkbox2: HTMLInputElement = screen.getByTestId(
      `checkbox-case-selection-${order.id}-case-list-1`,
    );

    fireEvent.click(checkbox1);
    fireEvent.click(checkbox2);

    selectTypeAndMarkLead();

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(approveButton as HTMLButtonElement);

    await waitFor(() => {
      expect(checkbox1.checked).toBeTruthy();
      expect(checkbox2.checked).toBeTruthy();
      expect(approveButton).toBeEnabled();
    });

    fireEvent.click(collapseButton as HTMLButtonElement); // collapse accordion

    fireEvent.click(collapseButton as HTMLButtonElement);
    checkbox1 = screen.getByTestId(`checkbox-case-selection-${order.id}-case-list-0`);
    checkbox2 = screen.getByTestId(`checkbox-case-selection-${order.id}-case-list-1`);

    await waitFor(() => {
      expect(checkbox1.checked).toBeFalsy();
      expect(checkbox2.checked).toBeFalsy();
      expect(approveButton).not.toBeEnabled();
    });
  });

  test('should select all checkboxes and enable approve button when Include All button is clicked (and consolidation type and lead case are set)', async () => {
    renderWithProps();
    openAccordion(order.id!);

    selectTypeAndMarkLead();

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    expect(approveButton).not.toBeEnabled();
    const includeAllButton = screen.getByTestId(
      `checkbox-label-${order.id}-case-list-checkbox-toggle`,
    );

    const checkboxList: NodeListOf<HTMLInputElement> = document.querySelectorAll(
      'table input[type="checkbox"]',
    );

    fireEvent.click(includeAllButton!);

    await waitFor(() => {
      for (const checkbox of checkboxList) {
        expect(checkbox.checked).toBeTruthy();
      }
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

    const markLeadCaseButton = screen.getByTestId('button-assign-lead-0');
    expect(markLeadCaseButton).toHaveClass('usa-button--outline');

    fireEvent.click(markLeadCaseButton);
    expect(markLeadCaseButton).not.toHaveClass('usa-button--outline');

    fireEvent.click(leadCaseFormCheckbox);

    waitFor(() => {
      expect(markLeadCaseButton).toHaveClass('usa-button--outline');
    });
  });

  test.skip('should show an alert if the lead case is already a part of another consolidation', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const leadCase = MockData.getCaseSummary();
    const associations = MockData.buildArray(
      () =>
        MockData.getConsolidationReference({
          override: {
            documentType: 'CONSOLIDATION_FROM',
          },
        }),
      3,
    );

    setupApiGetMock({ bCase: leadCase, associations });

    const leadCaseFormCheckbox = screen.getByTestId(
      `checkbox-lead-case-form-checkbox-toggle-${order.id}`,
    );
    expect(leadCaseFormCheckbox).not.toBeChecked();
    fireEvent.click(leadCaseFormCheckbox);
    expect(leadCaseFormCheckbox).toBeChecked();
    // Select lead case court.
    selectItemInMockSelect(`lead-case-court`, 1);

    // Enter case number.
    const leadCaseNumber = getCaseNumber(leadCase.caseId);
    const caseNumberInput = findCaseNumberInput(order.id!);
    await waitFor(() => {
      enterCaseNumber(caseNumberInput, leadCaseNumber);
      expect(caseNumberInput).toHaveValue(leadCaseNumber);
    });

    await waitFor(async () => {
      const form = document.querySelector('.lead-case-form-container');
      if (form) screen.debug(form);
      const alertElement = await screen.findByTestId(
        `alert-message-lead-case-number-alert-${order.id}`,
      );
      expect(alertElement).toHaveTextContent(`This case is already part of a consolidation.`);
    });
  });

  test('should show an alert if the lead case is a child case of another consolidation', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const leadCase = MockData.getCaseSummary();
    const otherLeadCase = MockData.getCaseSummary();
    const associations = MockData.buildArray(
      () =>
        MockData.getConsolidationReference({
          override: {
            documentType: 'CONSOLIDATION_TO',
            caseId: leadCase.caseId,
            otherCase: otherLeadCase,
          },
        }),
      3,
    );

    setupApiGetMock({ bCase: leadCase, associations });

    const leadCaseFormCheckbox = screen.getByTestId(
      `checkbox-lead-case-form-checkbox-toggle-${order.id}`,
    );
    expect(leadCaseFormCheckbox).not.toBeChecked();
    fireEvent.click(leadCaseFormCheckbox);
    expect(leadCaseFormCheckbox).toBeChecked();
    // Select lead case court.
    selectItemInMockSelect(`lead-case-court`, 1);

    // Enter case number.
    const leadCaseNumber = getCaseNumber(leadCase.caseId);
    const caseNumberInput = findCaseNumberInput(order.id!);
    await waitFor(() => {
      enterCaseNumber(caseNumberInput, leadCaseNumber);
    });

    await waitFor(() => {
      expect(caseNumberInput).toHaveValue(leadCaseNumber);
    });

    const docDebug = document.querySelector(`.lead-case-form-container-${order.id}`);
    screen.debug(docDebug!);

    await waitFor(async () => {
      const alertElement = await screen.findByTestId(
        `alert-message-lead-case-number-alert-${order.id}`,
      );
      expect(alertElement).toHaveTextContent(
        `Case ${leadCaseNumber} is a consolidated child case of case ${getCaseNumber(otherLeadCase.caseId)}.`,
      );
    });
  });
});

describe('Test exported functions', () => {
  const order: ConsolidationOrder = MockData.getConsolidationOrder();
  let mockFeatureFlags: FeatureFlagSet;

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    mockFeatureFlags = {
      'consolidations-enabled': true,
    };
    vitest.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
  });

  test('should return empty array when no attorneys are found', async () => {
    vi.spyOn(Chapter15MockApi, 'get').mockImplementation((_path: string) => {
      return Promise.resolve({
        success: true,
        message: '',
        count: 1,
        body: [],
      } as SimpleResponseData<CaseAssignment[]>);
    });

    const attorneys = await fetchLeadCaseAttorneys(order.childCases[0].caseId);
    expect(attorneys).toEqual([]);
  });

  test('should return string array of attorneys when found', async () => {
    const mockAttorneys: CaseAssignment[] = MockData.buildArray(
      () => MockData.getAttorneyAssignment(),
      3,
    );
    const attorneyArray = mockAttorneys.map((assignment) => assignment.name);
    vi.spyOn(Chapter15MockApi, 'get').mockImplementation((_path: string) => {
      return Promise.resolve({
        success: true,
        message: '',
        count: 1,
        body: mockAttorneys,
      } as SimpleResponseData<CaseAssignment[]>);
    });

    const attorneys = await fetchLeadCaseAttorneys(order.childCases[0].caseId);
    expect(attorneys).toEqual(attorneyArray);
  });
});
