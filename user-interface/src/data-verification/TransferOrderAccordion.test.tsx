import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { TransferOrder } from '@/lib/type-declarations/chapter-15';
import { AlertDetails } from './DataVerificationScreen';
import { BrowserRouter } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import {
  CaseSelection,
  TransferOrderAccordion,
  TransferOrderAccordionProps,
} from './TransferOrderAccordion';
import React from 'react';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Api from '@/lib/models/api';
import { describe } from 'vitest';
import { orderType, orderStatusType } from '@/lib/utils/labels';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { OfficeDetails } from '@common/cams/courts';
import { getOfficeList, validateCaseNumberInput } from './dataVerificationHelper';
import { selectItemInMockSelect } from '@/lib/components/SearchableSelect.mock';

function isValidOrderTransfer(transfer: {
  newCase?: { caseId?: string; courtDivisionName?: string };
}) {
  return transfer.newCase?.caseId && transfer.newCase?.courtDivisionName;
}

vi.mock(
  '../lib/components/SearchableSelect',
  () => import('../lib/components/SearchableSelect.mock'),
);

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

function findActionText(id: string, visible: boolean) {
  const content = screen.getByTestId(`action-text-${id}`);
  expect(content).toBeInTheDocument();
  if (visible) {
    expect(content).toBeVisible();
  } else {
    expect(content).not.toBeVisible();
  }
  return content;
}

function findCaseNumberInputInAccordion(id: string) {
  const caseIdInput = document.querySelector(`input#new-case-input-${id}`);
  expect(caseIdInput).toBeInTheDocument();
  return caseIdInput;
}

function enterCaseNumberInAccordion(caseIdInput: Element | null | undefined, value: string) {
  if (!caseIdInput) throw Error();

  fireEvent.change(caseIdInput!, { target: { value } });
  expect(caseIdInput).toHaveValue(value);

  return caseIdInput;
}

describe('TransferOrderAccordion', () => {
  let order: TransferOrder;
  const regionMap = new Map();
  regionMap.set('02', 'NEW YORK');
  const testOffices: OfficeDetails[] = [
    {
      courtDivision: '001',
      groupDesignator: 'AA',
      courtId: '0101',
      officeCode: '1',
      officeName: 'A1',
      state: 'NY',
      courtName: 'A',
      courtDivisionName: 'New York 1',
      regionId: '02',
      regionName: 'NEW YORK',
    },
    {
      courtDivision: '003',
      groupDesignator: 'AC',
      courtId: '0103',
      officeCode: '3',
      officeName: 'C1',
      state: 'NY',
      courtName: 'C',
      courtDivisionName: 'New York 1',
      regionId: '02',
      regionName: 'NEW YORK',
    },
    {
      courtDivision: '002',
      groupDesignator: 'AB',
      courtId: '0102',
      officeCode: '2',
      officeName: 'B1',
      state: 'NY',
      courtName: 'B',
      courtDivisionName: 'New York 1',
      regionId: '02',
      regionName: 'NEW YORK',
    },
  ];

  function renderWithProps(props?: Partial<TransferOrderAccordionProps>) {
    const defaultProps: TransferOrderAccordionProps = {
      order: order,
      officesList: testOffices,
      orderType,
      statusType: orderStatusType,
      onOrderUpdate: () => {},
      onExpand: () => {},
      regionsMap: regionMap,
    };

    const renderProps = { ...defaultProps, ...props };
    render(
      <BrowserRouter>
        <TransferOrderAccordion {...renderProps} />
      </BrowserRouter>,
    );
  }

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    order = MockData.getTransferOrder();
    vi.spyOn(Chapter15MockApi, 'get').mockResolvedValueOnce({
      message: '',
      count: 1,
      body: { dateFiled: order.dateFiled, debtor: order.debtor },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should render an order', async () => {
    renderWithProps();

    const heading = findAccordionHeading(order.id);

    expect(heading?.textContent).toContain(order.courtName);
    expect(heading?.textContent).toContain(formatDate(order.orderDate));

    const content = findAccordionContent(order.id, false);

    expect(content?.textContent).toContain(order.docketEntries[0]?.summaryText);
    expect(content?.textContent).toContain(order.docketEntries[0]?.fullText);

    const form = screen.getByTestId(`order-form-${order.id}`);
    expect(form).toBeInTheDocument();
  });

  test('should expand and show detail when a header is clicked', async () => {
    let heading;
    renderWithProps();

    await waitFor(async () => {
      heading = findAccordionHeading(order.id);
      findAccordionContent(order.id, false);
    });

    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      findAccordionContent(order.id, true);
    });
  });

  test('should expand and show order reject details with reason undefined when a rejected header is clicked if rejection does not have a reason.', async () => {
    let heading;
    const rejectedOrder: TransferOrder = { ...order, reason: '', status: 'rejected' };

    renderWithProps({
      order: rejectedOrder,
    });

    await waitFor(async () => {
      heading = findAccordionHeading(order.id);
    });

    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      const content = findAccordionContent(order.id, true);
      expect(content).toHaveTextContent(`Rejected transfer of ${getCaseNumber(order.caseId)}.`);
    });
  });

  test('should expand and show order reject details with reason when a rejected header is clicked that does have a reason defined', async () => {
    let heading;
    const rejectedOrder: TransferOrder = { ...order, reason: 'order is bad', status: 'rejected' };

    renderWithProps({
      order: rejectedOrder,
    });

    await waitFor(async () => {
      heading = findAccordionHeading(order.id);
    });

    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      const content = findAccordionContent(order.id, true);
      expect(content).toHaveTextContent(
        `Rejected transfer of ${getCaseNumber(order.caseId)} for the following reason:order is bad`,
      );
    });
  });

  test('should expand and show order transfer information when an order has been approved', async () => {
    let heading;

    const mockedApprovedOrder: TransferOrder = MockData.getTransferOrder({
      override: {
        status: 'approved',
      },
    });

    renderWithProps({
      order: mockedApprovedOrder,
    });

    await waitFor(async () => {
      heading = findAccordionHeading(mockedApprovedOrder.id);
    });

    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      const actionText = findActionText(mockedApprovedOrder.id, true);
      expect(actionText).toHaveTextContent(
        `Transferred ${getCaseNumber(mockedApprovedOrder.caseId)} from${mockedApprovedOrder.courtName} (${mockedApprovedOrder.courtDivisionName})to ${getCaseNumber(mockedApprovedOrder.newCase?.caseId)} and court${mockedApprovedOrder.newCase?.courtName} (${mockedApprovedOrder.newCase?.courtDivisionName}).`,
      );
    });
  });

  test('should show preview description when a court is selected', async () => {
    renderWithProps();

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      findAccordionContent(order.id, false);
    });

    const heading = findAccordionHeading(order.id);
    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      findAccordionContent(order.id, true);
    });

    /**
     * SearchableSelect is a black box.  We can't fire events on it.  We'll have to mock onChange on it.
     */
    selectItemInMockSelect(`court-selection-${order.id}`, 1);

    let preview: HTMLElement;
    await waitFor(async () => {
      preview = screen.getByTestId(`preview-description-${order.id}`);
      expect(preview).toBeInTheDocument();
      expect(preview).toBeVisible();
      expect(preview?.textContent).toEqual(
        `USTP Office: transfer fromRegion ${parseInt(order.regionId)} - ${order.courtDivisionName}toRegion ${parseInt(testOffices[0].regionId)} - ${testOffices[0].courtDivisionName}`,
      );
    });
  });

  test('should display modal and when Approve is clicked, upon submission of modal should update the status of order to approved', async () => {
    let heading: HTMLElement;
    const orderUpdateSpy = vi
      .fn()
      .mockImplementation((_alertDetails: AlertDetails, _order?: TransferOrder) => {});

    const patchSpy = vi.spyOn(Chapter15MockApi, 'patch').mockResolvedValue({
      message: 'Rejected',
      count: 1,
      body: {
        dateFiled: order.dateFiled,
        debtor: order.debtor,
      },
    });

    renderWithProps({
      onOrderUpdate: orderUpdateSpy,
    });

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      findAccordionContent(order.id, false);
    });

    await waitFor(async () => {
      heading = findAccordionHeading(order.id);
    }).then(() => {
      fireEvent.click(heading);
    });

    selectItemInMockSelect(`court-selection-${order.id}`, 1);

    const caseNumber = '24-12345';
    const input = findCaseNumberInputInAccordion(order.id);
    enterCaseNumberInAccordion(input, caseNumber);

    let approveButton;
    await waitFor(() => {
      approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(approveButton!);

    let confirmModal: HTMLElement;
    await waitFor(async () => {
      confirmModal = screen.getByTestId('toggle-modal-button-submit');
      expect(confirmModal).toBeInTheDocument();
      expect(confirmModal).toBeVisible();
    });
    fireEvent.click(confirmModal!);

    await waitFor(async () => {
      expect(orderUpdateSpy).toHaveBeenCalled();
    });

    const expectedInput = {
      caseId: order.caseId,
      id: order.id,
      newCase: {
        caseId: `${testOffices[0].courtDivision}-${caseNumber}`,
        courtDivision: testOffices[0].courtDivision,
        courtDivisionName: testOffices[0].courtDivisionName,
        courtName: testOffices[0].courtName,
        regionId: testOffices[0].regionId,
        regionName: testOffices[0].regionName,
      },
      orderType: 'transfer',
      status: 'approved',
    };

    expect(patchSpy).toHaveBeenCalledWith(`/orders/${order.id}`, expectedInput);
  });

  test('should properly reject when API returns a successful response and a reason is supplied', async () => {
    let heading: HTMLElement;

    const orderUpdateSpy = vi
      .fn()
      .mockImplementation((_alertDetails: AlertDetails, _order?: TransferOrder) => {});

    const patchSpy = vi.spyOn(Chapter15MockApi, 'patch').mockResolvedValue({
      message: 'Rejected',
      count: 1,
      body: {
        dateFiled: order.dateFiled,
        debtor: order.debtor,
      },
    });

    renderWithProps({
      onOrderUpdate: orderUpdateSpy,
    });

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      findAccordionContent(order.id, false);
    });

    await waitFor(async () => {
      heading = findAccordionHeading(order.id);
    }).then(() => {
      fireEvent.click(heading);
    });

    selectItemInMockSelect(`court-selection-${order.id}`, 1);

    const input = findCaseNumberInputInAccordion(order.id);
    enterCaseNumberInAccordion(input, '24-12345');

    let rejectButton;
    await waitFor(() => {
      rejectButton = screen.getByTestId(`button-accordion-reject-button-${order.id}`);
      expect(rejectButton).toBeEnabled();
    });
    fireEvent.click(rejectButton!);

    let rejectionReasonInput: HTMLElement;
    const rejectionValue = 'order has been rejected';
    let confirmModal: HTMLElement;

    await waitFor(async () => {
      rejectionReasonInput = screen.getByTestId(
        `rejection-reason-input-confirmation-modal-${order.id}`,
      );
      fireEvent.change(rejectionReasonInput!, { target: { value: rejectionValue } });
      expect(rejectionReasonInput).toHaveValue(rejectionValue);

      confirmModal = screen.getByTestId('toggle-modal-button-submit');
      expect(confirmModal).toBeInTheDocument();
    });
    fireEvent.click(confirmModal!);

    const rejectedOrder = {
      ...order,
      status: 'rejected',
      reason: rejectionValue,
    };
    await waitFor(async () => {
      expect(orderUpdateSpy).toHaveBeenCalledWith(
        {
          message: `Transfer of case ${getCaseNumber(order.caseId)} was rejected.`,
          type: UswdsAlertStyle.Success,
          timeOut: 8,
        },
        rejectedOrder,
      );

      const expectedInput = {
        caseId: rejectedOrder.caseId,
        id: rejectedOrder.id,
        orderType: 'transfer',
        reason: rejectionValue,
        status: 'rejected',
      };

      expect(patchSpy).toHaveBeenCalledWith(`/orders/${order.id}`, expectedInput);
    });
  });

  test('should properly clear rejection reason when modal is closed without submitting rejection', async () => {
    let heading: HTMLElement;
    const orderUpdateSpy = vi
      .fn()
      .mockImplementation((_alertDetails: AlertDetails, _order?: TransferOrder) => {});

    renderWithProps({
      onOrderUpdate: orderUpdateSpy,
    });

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      findAccordionContent(order.id, false);
    });

    await waitFor(async () => {
      heading = findAccordionHeading(order.id);
    }).then(() => {
      fireEvent.click(heading);
    });

    selectItemInMockSelect(`court-selection-${order.id}`, 1);

    const input = findCaseNumberInputInAccordion(order.id);
    enterCaseNumberInAccordion(input, '24-12345');

    let rejectButton;
    await waitFor(() => {
      rejectButton = screen.getByTestId(`button-accordion-reject-button-${order.id}`);
      expect(rejectButton).toBeEnabled();
    });
    fireEvent.click(rejectButton!);

    let rejectionReasonInput: HTMLElement;
    const rejectionValue = 'order has been rejected';

    await waitFor(async () => {
      rejectionReasonInput = screen.getByTestId(
        `rejection-reason-input-confirmation-modal-${order.id}`,
      );
      fireEvent.change(rejectionReasonInput!, { target: { value: rejectionValue } });
      expect(rejectionReasonInput).toHaveValue(rejectionValue);
    });
    let goBack: HTMLElement;
    await waitFor(async () => {
      goBack = screen.getByTestId('toggle-modal-button-cancel');
      expect(goBack).toBeInTheDocument();
      expect(goBack).toBeVisible();
    });
    fireEvent.click(goBack!);

    fireEvent.click(rejectButton!);

    expect(rejectionReasonInput!).toHaveValue('');
    // Try again, now with the close button on the modal.
    let modalCloseButton: HTMLElement;
    await waitFor(async () => {
      modalCloseButton = screen.getByTestId(
        `modal-x-button-confirm-modal-confirmation-modal-${order.id}`,
      );
      expect(modalCloseButton).toBeInTheDocument();
      expect(modalCloseButton).toBeVisible();
    });

    await waitFor(async () => {
      fireEvent.change(rejectionReasonInput!, { target: { value: rejectionValue } });
      expect(rejectionReasonInput).toHaveValue(rejectionValue);
    });
    fireEvent.click(modalCloseButton!);
    fireEvent.click(rejectButton!);
    expect(rejectionReasonInput!).toHaveValue('');
  });

  test('should throw error durring Approval when API returns an error', async () => {
    let heading: HTMLElement;
    const errorMessage = 'Some random error';
    vi.spyOn(Chapter15MockApi, 'patch').mockRejectedValue(new Error(errorMessage));
    const orderUpdateSpy = vi
      .fn()
      .mockImplementation((_alertDetails: AlertDetails, _order?: TransferOrder) => {});

    renderWithProps({
      onOrderUpdate: orderUpdateSpy,
    });

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      findAccordionContent(order.id, false);
    });

    await waitFor(async () => {
      heading = findAccordionHeading(order.id);
    }).then(() => {
      fireEvent.click(heading);
    });

    selectItemInMockSelect(`court-selection-${order.id}`, 1);

    const input = findCaseNumberInputInAccordion(order.id);
    enterCaseNumberInAccordion(input, '24-12345');

    let approveButton;
    await waitFor(() => {
      approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(approveButton!);

    let confirmModal: HTMLElement;
    await waitFor(async () => {
      confirmModal = screen.getByTestId('toggle-modal-button-submit');
      expect(confirmModal).toBeInTheDocument();
    });
    fireEvent.click(confirmModal!);

    await waitFor(async () => {
      expect(orderUpdateSpy).toHaveBeenCalled();
      expect(orderUpdateSpy).toHaveBeenCalledWith({
        message: errorMessage,
        type: UswdsAlertStyle.Error,
        timeOut: 8,
      });
    });
  });

  test('should throw error durring Rejection when API returns an error', async () => {
    let heading: HTMLElement;
    const errorMessage = 'Some random error';
    vi.spyOn(Chapter15MockApi, 'patch').mockRejectedValue(new Error(errorMessage));
    const orderUpdateSpy = vi
      .fn()
      .mockImplementation((_alertDetails: AlertDetails, _order?: TransferOrder) => {});

    renderWithProps({
      onOrderUpdate: orderUpdateSpy,
    });

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      findAccordionContent(order.id, false);
    });

    await waitFor(async () => {
      heading = findAccordionHeading(order.id);
    }).then(() => {
      fireEvent.click(heading);
    });

    selectItemInMockSelect(`court-selection-${order.id}`, 1);

    const input = findCaseNumberInputInAccordion(order.id);
    enterCaseNumberInAccordion(input, '24-12345');

    let rejectButton;
    await waitFor(() => {
      rejectButton = screen.getByTestId(`button-accordion-reject-button-${order.id}`);
      expect(rejectButton).toBeEnabled();
    });
    fireEvent.click(rejectButton!);

    let confirmModal: HTMLElement;
    await waitFor(async () => {
      confirmModal = screen.getByTestId('toggle-modal-button-submit');
      expect(confirmModal).toBeInTheDocument();
    });
    fireEvent.click(confirmModal!);

    await waitFor(async () => {
      expect(orderUpdateSpy).toHaveBeenCalled();
      expect(orderUpdateSpy).toHaveBeenCalledWith({
        message: errorMessage,
        type: UswdsAlertStyle.Error,
        timeOut: 8,
      });
    });
  });

  test('should leave input fields and data in place when closing the modal without approving', async () => {
    let heading: HTMLElement;
    const orderUpdateSpy = vi
      .fn()
      .mockImplementation((_alertDetails: AlertDetails, _order?: TransferOrder) => {});

    renderWithProps({
      onOrderUpdate: orderUpdateSpy,
    });

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      findAccordionContent(order.id, false);
    });

    await waitFor(async () => {
      heading = findAccordionHeading(order.id);
    }).then(() => {
      fireEvent.click(heading);
    });

    selectItemInMockSelect(`court-selection-${order.id}`, 1);

    const newUserInput = '24-12345';
    const caseIdInput = findCaseNumberInputInAccordion(order.id);
    enterCaseNumberInAccordion(caseIdInput, newUserInput);

    let approveButton;
    await waitFor(() => {
      approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
      expect(approveButton).toBeEnabled();
    });
    fireEvent.click(approveButton!);

    // Use the "go back" link to close the modal.
    let goBack: HTMLElement;
    await waitFor(async () => {
      goBack = screen.getByTestId('toggle-modal-button-cancel');
      expect(goBack).toBeInTheDocument();
      expect(goBack).toBeVisible();
    });
    fireEvent.click(goBack!);

    await waitFor(() => {
      expect(caseIdInput).toHaveValue(newUserInput);
    });

    // Try again, now with the close button on the modal.
    fireEvent.click(approveButton!);
    let modalCloseButton: HTMLElement;
    await waitFor(async () => {
      modalCloseButton = screen.getByTestId(
        `modal-x-button-confirm-modal-confirmation-modal-${order.id}`,
      );
      expect(modalCloseButton).toBeInTheDocument();
      expect(modalCloseButton).toBeVisible();
    });
    fireEvent.click(modalCloseButton!);
    await waitFor(() => {
      expect(caseIdInput).toHaveValue(newUserInput);
    });
  });

  test('should clear input values and disable submission button when the Cancel button is clicked within the accordion', async () => {
    let heading: HTMLElement;
    const orderUpdateSpy = vi
      .fn()
      .mockImplementation((_alertDetails: AlertDetails, _order?: TransferOrder) => {});

    renderWithProps({
      onOrderUpdate: orderUpdateSpy,
    });

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      findAccordionContent(order.id, false);
    });

    await waitFor(async () => {
      heading = findAccordionHeading(order.id);
    }).then(() => {
      fireEvent.click(heading);
    });

    selectItemInMockSelect(`court-selection-${order.id}`, 1);

    const caseIdInput = findCaseNumberInputInAccordion(order.id);
    expect(caseIdInput).toHaveValue(order.docketSuggestedCaseNumber);

    const caseLookup = MockData.getCaseSummary({
      entityType: 'person',
      override: {
        debtor: {
          name: 'DebtorName',
          ssn: '111-11-1111',
        },
      },
    });

    enterCaseNumberInAccordion(caseIdInput, '00-00000');
    enterCaseNumberInAccordion(caseIdInput, '');
    let approveButton: HTMLElement;
    await waitFor(async () => {
      approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
      expect(approveButton).toBeInTheDocument();
      expect(approveButton).toBeVisible();
      expect(approveButton).toBeDisabled();
    });
    vi.spyOn(Api, 'get').mockImplementation((_path: string) => {
      return Promise.resolve({ message: '', count: 1, body: caseLookup });
    });

    enterCaseNumberInAccordion(caseIdInput, '23-12345');

    let cancelButton: HTMLElement;
    await waitFor(async () => {
      cancelButton = screen.getByTestId(`button-accordion-cancel-button-${order.id}`);
      expect(cancelButton).toBeInTheDocument();
      expect(cancelButton).toBeVisible();
    });

    fireEvent.click(cancelButton!);

    await waitFor(() => {
      expect(caseIdInput).toHaveValue(order.docketSuggestedCaseNumber);
    });
  });

  test('should display modal and when Reject is clicked', async () => {
    let heading: HTMLElement;
    const orderUpdateSpy = vi
      .fn()
      .mockImplementation((_alertDetails: AlertDetails, _order?: TransferOrder) => {});

    renderWithProps({
      onOrderUpdate: orderUpdateSpy,
    });

    expect(order.status).toBe('pending');

    await waitFor(async () => {
      findAccordionContent(order.id, false);
    });

    await waitFor(async () => {
      heading = findAccordionHeading(order.id);
    }).then(() => {
      fireEvent.click(heading);
    });

    selectItemInMockSelect(`court-selection-${order.id}`, 1);

    const caseIdInput = findCaseNumberInputInAccordion(order.id);
    enterCaseNumberInAccordion(caseIdInput, '24-12345');

    let rejectButton;
    await waitFor(() => {
      rejectButton = screen.getByTestId(`button-accordion-reject-button-${order.id}`);
      expect(rejectButton).toBeEnabled();
    });
    fireEvent.click(rejectButton!);

    let confirmModal: HTMLElement;
    await waitFor(async () => {
      confirmModal = screen.getByTestId('toggle-modal-button-submit');
      expect(confirmModal).toBeInTheDocument();
      expect(confirmModal).toBeVisible();
    });
    fireEvent.click(confirmModal!);

    await waitFor(async () => {
      expect(orderUpdateSpy).toHaveBeenCalled();
    });
  });

  test('should allow a court to be deselected', async () => {
    renderWithProps();

    await waitFor(async () => {
      findAccordionContent(order.id, false);
    });

    const heading = findAccordionHeading(order.id);
    if (heading) fireEvent.click(heading);

    await waitFor(async () => {
      findAccordionContent(order.id, true);
    });

    selectItemInMockSelect(`court-selection-${order.id}`, 1);

    let preview: HTMLElement;
    await waitFor(async () => {
      preview = screen.getByTestId(`preview-description-${order.id}`);
      expect(preview).toBeInTheDocument();
      expect(preview).toBeVisible();
      expect(preview?.textContent).toEqual(
        `USTP Office: transfer fromRegion ${parseInt(order.regionId)} - ${order.courtDivisionName}toRegion ${parseInt(testOffices[0].regionId)} - ${testOffices[0].courtDivisionName}`,
      );
    });

    selectItemInMockSelect(`court-selection-${order.id}`, 0);

    await waitFor(async () => {
      const preview = screen.queryByTestId(`preview-description-${order.id}`);
      expect(preview).not.toBeInTheDocument();
    });
  });

  test('should allow the new case ID to be entered', async () => {
    renderWithProps();

    await waitFor(async () => {
      findAccordionContent(order.id, false);
    });

    const heading = findAccordionHeading(order.id);
    if (heading) fireEvent.click(heading);

    let newCaseNumberText;
    await waitFor(async () => {
      newCaseNumberText = findCaseNumberInputInAccordion(order.id);
      expect(newCaseNumberText).toHaveValue(order.docketSuggestedCaseNumber);
    });

    const newValue = '22-33333';
    enterCaseNumberInAccordion(newCaseNumberText, newValue);

    await waitFor(async () => {
      const newCaseNumberText = screen.getByTestId(`new-case-input-${order.id}`);
      expect(newCaseNumberText).toHaveValue(newValue);
    });
    // TODO: add test for changing caseID line 225-226
  });

  test('should show a case summary when a case is found', async () => {
    renderWithProps();

    await waitFor(async () => {
      findAccordionContent(order.id, false);
    });

    const heading = findAccordionHeading(order.id);
    if (heading) fireEvent.click(heading);

    let newCaseNumberText;
    await waitFor(async () => {
      newCaseNumberText = findCaseNumberInputInAccordion(order.id);
      expect(newCaseNumberText).toHaveValue(order.docketSuggestedCaseNumber);
    });

    selectItemInMockSelect(`court-selection-${order.id}`, 1);

    const newValue = '22-33333';
    enterCaseNumberInAccordion(newCaseNumberText, newValue);

    await waitFor(async () => {
      const validatedCases = screen.getByTestId(`validated-cases`);
      expect(validatedCases).toBeInTheDocument();

      const alert = screen.queryByTestId(`alert-container-validation-not-found`);
      expect(alert).not.toBeInTheDocument();
    });
  });

  test('should show not found message when a case is not found', async () => {
    renderWithProps();

    await waitFor(async () => {
      findAccordionContent(order.id, false);
    });

    const heading = findAccordionHeading(order.id);
    if (heading) fireEvent.click(heading);

    let newCaseNumberText;
    await waitFor(async () => {
      newCaseNumberText = findCaseNumberInputInAccordion(order.id);
      expect(newCaseNumberText).toHaveValue(order.docketSuggestedCaseNumber);
    });

    selectItemInMockSelect(`court-selection-${order.id}`, 1);

    const newValue = '77-77777';
    enterCaseNumberInAccordion(newCaseNumberText, newValue);

    await waitFor(async () => {
      const validatedCases = screen.queryByTestId(`validated-cases`);
      expect(validatedCases).not.toBeInTheDocument();

      const alert = screen.queryByTestId(`alert-container-validation-not-found`);
      expect(alert).toBeInTheDocument();
    });
  });

  test('should determine if an transfer update DTO is valid', () => {
    const ok = isValidOrderTransfer({
      newCase: {
        caseId: '222-33-44444',
        courtDivisionName: 'new court',
      },
    });
    expect(ok).toBeTruthy();

    const notOk = isValidOrderTransfer({});
    expect(notOk).toBeFalsy();
  });

  // test('should limit user input to a valid case ID', () => {
  //   const validInput = buildChangeEvent('11-22222');
  //   const ok = validateCaseNumberInput(validInput);
  //   expect(ok.joinedInput).toEqual('');
  //   expect(ok.caseNumber).toBeUndefined;

  //   const invalidInput = buildChangeEvent('lahwrunxhncntgftitjt');
  //   const notOK = validateCaseNumberInput(invalidInput);
  //   expect(notOK.joinedInput).toEqual('');
  //   expect(notOK.caseNumber).toBeUndefined;
  // });

  test('should get office select options', () => {
    const expectedOptions: Array<Record<string, string>> = [
      { value: '', label: ' ' },
      { value: '001', label: 'A (New York 1)' },
      { value: '002', label: 'B (New York 1)' },
      { value: '003', label: 'C (New York 1)' },
    ];

    const sortedTestOffices = [...testOffices].sort((a, b) =>
      a.courtDivision < b.courtDivision ? -1 : 1,
    );

    const actualOptions = getOfficeList(sortedTestOffices);
    expect(actualOptions).toStrictEqual(expectedOptions);
  });
});

describe('Test CaseSelection component', () => {
  function renderWithProps(props: { region1: string; region2: string }) {
    render(
      <CaseSelection
        fromCourt={{
          region: props.region1,
          courtDivisionName: 'Division Name 1',
        }}
        toCourt={{
          region: props.region2,
          courtDivisionName: 'Division Name 2',
        }}
      ></CaseSelection>,
    );
  }

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
  });

  test('Should display message as expected using toCourt and fromCourt', async () => {
    renderWithProps({ region1: '1', region2: '002' });

    expect(document.body).toHaveTextContent(
      'USTP Office: transfer fromRegion 1 - Division Name 1toRegion 2 - Division Name 2',
    );
  });

  test('Should properly display region as a non-numeric string when one is supplied', async () => {
    renderWithProps({ region1: 'ABC', region2: 'BCD' });

    expect(document.body).toHaveTextContent(
      'USTP Office: transfer fromRegion ABC - Division Name 1toRegion BCD - Division Name 2',
    );
  });
});

describe('Test validateCaseNumberInput function', () => {
  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
  });

  test('When supplied a value with a length greater than 7, it should truncate value to 7 digits', async () => {
    const testValue = '1234567890';
    const resultValue = '12-34567';

    const expectedResult = {
      caseNumber: resultValue,
      joinedInput: resultValue,
    };

    const testEvent = {
      target: {
        value: testValue,
      },
    };

    const returnedValue = validateCaseNumberInput(testEvent as React.ChangeEvent<HTMLInputElement>);
    expect(returnedValue).toEqual(expectedResult);
  });

  test('When supplied a value with alphabetic characters only, it should return an object with undefined caseNumber and empty string for joinedInput', async () => {
    const testValue = 'abcdefg';
    const resultValue = '';

    const expectedResult = {
      caseNumber: undefined,
      joinedInput: resultValue,
    };

    const testEvent = {
      target: {
        value: testValue,
      },
    };

    const returnedValue = validateCaseNumberInput(testEvent as React.ChangeEvent<HTMLInputElement>);
    expect(returnedValue).toEqual(expectedResult);
  });
});
