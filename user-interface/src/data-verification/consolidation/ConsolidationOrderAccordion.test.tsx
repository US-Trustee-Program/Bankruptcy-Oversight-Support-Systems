import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { orderType, orderStatusType } from '@/lib/utils/labels';
import { BrowserRouter } from 'react-router-dom';
import { ConsolidationOrder } from '@common/cams/orders';
import {
  ConsolidationOrderAccordion,
  ConsolidationOrderAccordionProps,
} from '@/data-verification/consolidation/ConsolidationOrderAccordion';
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
import { selectItemInMockSelect } from '@/lib/components/CamsSelect.mock';

vi.mock('../../lib/components/CamsSelect', () => import('@/lib/components/CamsSelect.mock'));

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
    } else if (path.match(/\/cases\/\d\d\d-00-00000\/summary/i)) {
      return Promise.reject({ message: 'Some strange error were not expecting' });
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
  const order: ConsolidationOrder = MockData.getConsolidationOrder({
    override: { courtDivisionCode: '081' },
  });
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
    setupApiGetMock();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
    const checkbox: HTMLInputElement = screen.getByTestId(
      `checkbox-case-selection-case-list-${oid}-${idx}`,
    );
    fireEvent.click(checkbox);
    return checkbox;
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

  test('should correctly enable/disable buttons when selecting consolidated cases and lead case from order case list table', async () => {
    renderWithProps();
    openAccordion(order.id!);
    setupApiGetMock({ bCase: order.childCases[0] });

    const includeAllCheckbox = document.querySelector(`.checkbox-toggle label`);
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

    fireEvent.click(firstCheckbox);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    fireEvent.click(secondCheckbox);
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
    fireEvent.click(secondCheckbox);
    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });
    vi.spyOn(Chapter15MockApi, 'get').mockReset();
  });

  test('should correctly enable/disable buttons based on selections in "case not listed" form', async () => {
    renderWithProps();
    openAccordion(order.id!);
    setupApiGetMock({ bCase: order.childCases[0] });

    const includeAllCheckbox = document.querySelector(`.checkbox-toggle label`);
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

    selectItemInMockSelect(`lead-case-court`, 0);

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

    selectItemInMockSelect(`lead-case-court`, 0);
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
    vi.spyOn(Chapter15MockApi, 'get').mockReset();
  });

  test('should show alert when no lead case can be found in search field, and case table when search finds a matching value', async () => {
    renderWithProps();
    openAccordion(order.id!);
    setupApiGetMock({ bCase: order.childCases[0] });

    await toggleEnableCaseListForm(order.id!);

    selectItemInMockSelect(`lead-case-court`, 0);
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

    selectItemInMockSelect(`lead-case-court`, 0);
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
    vi.spyOn(Chapter15MockApi, 'get').mockReset();
  });

  test('should show alert when no lead case can be found in search field, and error returned was not a 404', async () => {
    renderWithProps();
    openAccordion(order.id!);
    setupApiGetMock({ bCase: order.childCases[0] });

    await toggleEnableCaseListForm(order.id!);

    selectItemInMockSelect(`lead-case-court`, 0);
    const caseNumberInput = findCaseNumberInput(order.id!);

    enterCaseNumber(caseNumberInput, '00000000');

    await waitFor(() => {
      const alert = findValidCaseNumberAlert(order.id!);
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Cannot verify lead case number.');
      expect(findValidCaseNumberTable(order.id!)).not.toBeInTheDocument();
    });
    vi.spyOn(Chapter15MockApi, 'get').mockReset();
  });

  test('should show alert when lookup of associated cases fails', async () => {
    renderWithProps();
    openAccordion(order.id!);
    const testCase = { ...order.childCases[0] };
    testCase.caseId = '999-99-99999';
    setupApiGetMock({ bCase: testCase });

    await toggleEnableCaseListForm(order.id!);

    selectItemInMockSelect(`lead-case-court`, 0);
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
    vi.spyOn(Chapter15MockApi, 'get').mockReset();
  });

  test('should open approval modal when approve button is clicked', async () => {
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

    vi.spyOn(Chapter15MockApi, 'put').mockResolvedValue({
      message: '',
      count: 1,
      body: [expectedOrderRejected],
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
    vi.spyOn(Chapter15MockApi, 'put').mockRejectedValue(new Error(errorMessage));

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

  test('should clear checkboxes and disable approve button when cancel is clicked', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    const rejectButton = document.querySelector(`#accordion-reject-button-${order.id}`);
    const cancelButton = document.querySelector(`#accordion-cancel-button-${order.id}`);
    expect(approveButton).not.toBeEnabled();
    expect(rejectButton).not.toBeEnabled();

    const checkbox1 = clickCaseCheckbox(order.id!, 0);
    const checkbox2 = clickCaseCheckbox(order.id!, 1);

    expect(approveButton).not.toBeEnabled();

    selectTypeAndMarkLead();

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });
    fireEvent.click(approveButton as HTMLButtonElement);

    await waitFor(() => {
      expect(checkbox1.checked).toBeTruthy();
      expect(checkbox2.checked).toBeTruthy();
      expect(approveButton).toBeEnabled();
      expect(rejectButton).toBeEnabled();
    });

    fireEvent.click(cancelButton as HTMLButtonElement);

    await waitFor(() => {
      expect(checkbox1.checked).toBeFalsy();
      expect(checkbox2.checked).toBeFalsy();
      expect(approveButton).not.toBeEnabled();
      expect(rejectButton).not.toBeEnabled();
    });
  });

  test('should clear checkboxes and disable approve button when accordion is collapsed', async () => {
    renderWithProps();
    openAccordion(order.id!);

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    const collapseButton = screen.getByTestId(`accordion-button-order-list-${order.id}`);
    expect(approveButton).not.toBeEnabled();

    let checkbox1 = clickCaseCheckbox(order.id!, 0);
    let checkbox2 = clickCaseCheckbox(order.id!, 1);

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
    checkbox1 = screen.getByTestId(`checkbox-case-selection-case-list-${order.id}-0`);
    checkbox2 = screen.getByTestId(`checkbox-case-selection-case-list-${order.id}-1`);

    await waitFor(() => {
      expect(checkbox1.checked).toBeFalsy();
      expect(checkbox2.checked).toBeFalsy();
      expect(approveButton).not.toBeEnabled();
    });
  });

  test('should select all checkboxes and enable approve button when Include All button is clicked and consolidation type and lead case are set', async () => {
    renderWithProps();
    openAccordion(order.id!);
    setupApiGetMock();

    selectTypeAndMarkLead();

    const approveButton = document.querySelector(`#accordion-approve-button-${order.id}`);
    expect(approveButton).not.toBeEnabled();
    const includeAllButton = screen.getByTestId(
      `checkbox-label-case-list-${order.id}-checkbox-toggle`,
    );

    const checkboxList: NodeListOf<HTMLInputElement> = document.querySelectorAll(
      'table input[type="checkbox"]',
    );

    fireEvent.click(includeAllButton!);

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
