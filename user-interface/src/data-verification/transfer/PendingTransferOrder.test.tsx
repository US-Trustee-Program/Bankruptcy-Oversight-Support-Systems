import {
  PendingTransferOrder,
  PendingTransferOrderProps,
} from '@/data-verification/transfer/PendingTransferOrder';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Api2 from '@/lib/models/api2';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { CourtDivisionDetails } from '@common/cams/courts';
import { TransferOrder } from '@common/cams/orders';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { describe } from 'vitest';

const fromCaseSummary = MockData.getCaseSummary();
const toCaseSummary = MockData.getCaseSummary();
const suggestedCases = [toCaseSummary, MockData.getCaseSummary()];

const mockGetCaseSummary = { data: fromCaseSummary };
const mockGetCaseSummaryForToCase = { data: toCaseSummary };
const mockGetTransferredCaseSuggestions = { data: suggestedCases };
const mockGetTransferredCaseSuggestionsEmpty = { data: [] };

const regionMap = new Map();
regionMap.set('02', 'NEW YORK');
const testOffices: CourtDivisionDetails[] = [
  {
    courtDivisionCode: '001',
    courtDivisionName: 'New York 1',
    courtId: '0101',
    courtName: 'A',
    groupDesignator: 'AA',
    officeCode: '1',
    officeName: 'A1',
    regionId: '02',
    regionName: 'NEW YORK',
    state: 'NY',
  },
  {
    courtDivisionCode: '003',
    courtDivisionName: 'New York 1',
    courtId: '0103',
    courtName: 'C',
    groupDesignator: 'AC',
    officeCode: '3',
    officeName: 'C1',
    regionId: '02',
    regionName: 'NEW YORK',
    state: 'NY',
  },
  {
    courtDivisionCode: '002',
    courtDivisionName: 'New York 1',
    courtId: '0102',
    courtName: 'B',
    groupDesignator: 'AB',
    officeCode: '2',
    officeName: 'B1',
    regionId: '02',
    regionName: 'NEW YORK',
    state: 'NY',
  },
];

const mockTransferOrder = {
  docketEntries: [
    {
      dateFiled: '2024-01-01',
      documentNumber: 1,
      documents: [],
      fullText: 'Order to transfer case',
      sequenceNumber: 1,
      summaryText: 'Transfer Order',
    },
  ],
  docketSuggestedCaseNumber: '24-12345',
  id: '8237b1bb-94b6-4434-b44c-77fbd906fe08',
  orderDate: '2024-01-01',
  orderType: 'transfer',
  status: 'pending',
  ...fromCaseSummary,
} as TransferOrder;

describe('PendingTransferOrder component', () => {
  describe('for suggested cases', () => {
    let order: TransferOrder;

    function renderWithProps(props?: Partial<PendingTransferOrderProps>) {
      const onOrderUpdate = vitest.fn();
      const defaultProps: PendingTransferOrderProps = {
        officesList: testOffices,
        onOrderUpdate,
        order,
      };

      const renderProps = { ...defaultProps, ...props };
      render(
        <BrowserRouter>
          <PendingTransferOrder {...renderProps} />
        </BrowserRouter>,
      );

      return {
        onOrderUpdate,
      };
    }

    beforeEach(async () => {
      vi.stubEnv('CAMS_PA11Y', 'true');
      order = { ...mockTransferOrder };
      vi.spyOn(Api2, 'getCaseSummary').mockResolvedValueOnce(mockGetCaseSummary);
      vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValueOnce(
        mockGetTransferredCaseSuggestions,
      );
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    test('should show suggested cases', async () => {
      renderWithProps();

      await waitFor(() => {
        const case0 = screen.getByTestId('suggested-cases-row-0');
        expect(case0).toBeInTheDocument();
      });
    });

    test('should show enabled approve button when a suggested case is selected', async () => {
      renderWithProps();

      let case0;
      await waitFor(() => {
        case0 = screen.getByTestId('button-radio-suggested-cases-checkbox-0-click-target');
        expect(case0).toBeInTheDocument();
      });

      const approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
      expect(approveButton).toBeDisabled();

      if (!case0) {
        throw Error();
      }

      await userEvent.click(case0);

      await waitFor(() => {
        expect(approveButton).toBeEnabled();
      });
    });

    test('should clear radio button selection when the cancel button is pressed', async () => {
      renderWithProps();

      let case0;
      await waitFor(() => {
        case0 = screen.getByTestId('button-radio-suggested-cases-checkbox-0-click-target');
        expect(case0).toBeInTheDocument();
      });

      let approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
      expect(approveButton).toBeDisabled();

      if (!case0) {
        throw Error();
      }

      await userEvent.click(case0);
      const case0RadioBtn = screen.getByTestId('radio-suggested-cases-checkbox-0');
      expect(case0RadioBtn).toBeChecked();

      await waitFor(() => {
        expect(approveButton).toBeEnabled();
      });

      const cancelButton = document.querySelector(`#accordion-cancel-button-${order.id}`);
      fireEvent.click(cancelButton!);

      expect(case0).not.toBeChecked();

      approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
      expect(approveButton).toBeDisabled();
    });
  });

  describe('for manually entered court and case number', () => {
    let order: TransferOrder;

    function renderWithProps(props?: Partial<PendingTransferOrderProps>) {
      const onOrderUpdate = vitest.fn();
      const defaultProps: PendingTransferOrderProps = {
        officesList: testOffices,
        onOrderUpdate,
        order,
      };

      const renderProps = { ...defaultProps, ...props };
      render(
        <BrowserRouter>
          <PendingTransferOrder {...renderProps} />
        </BrowserRouter>,
      );

      return {
        onOrderUpdate,
      };
    }

    async function selectItemInCombobox(orderId: string, index: number) {
      const courtComboboxItems = document.querySelectorAll(`#court-selection-${orderId} li`);
      await userEvent.click(courtComboboxItems[index]!);
    }

    function findCaseNumberInput(id: string) {
      const caseIdInput = document.querySelector(`input#new-case-input-${id}`);
      expect(caseIdInput).toBeInTheDocument();
      return caseIdInput;
    }

    function enterCaseNumber(caseIdInput: Element | null | undefined, value: string) {
      if (!caseIdInput) {
        throw Error();
      }

      fireEvent.change(caseIdInput!, { target: { value } });
      expect(caseIdInput).toHaveValue(value);

      return caseIdInput;
    }

    async function waitForCaseEntryForm() {
      await waitFor(() => {
        expect(document.querySelector('.case-entry-form')).toBeInTheDocument();
      });
    }

    async function waitForAlert() {
      await waitFor(() => {
        const instructions = screen.queryByTestId('suggested-cases-not-found');
        expect(instructions).toBeInTheDocument();
      });
    }

    beforeEach(async () => {
      vi.stubEnv('CAMS_PA11Y', 'true');
      order = MockData.getTransferOrder();
      vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue(mockGetCaseSummary);
      vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValueOnce(
        mockGetTransferredCaseSuggestionsEmpty,
      );
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    test('should display modal and when Approve is clicked, upon submission of modal should update the status of order to approved', async () => {
      const patchSpy = vi.spyOn(Api2, 'patchTransferOrderApproval').mockImplementation(() => {
        return Promise.resolve();
      });
      vi.spyOn(Api2, 'getCaseSummary')
        .mockResolvedValueOnce(mockGetCaseSummary)
        .mockResolvedValueOnce(mockGetCaseSummaryForToCase);
      vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValueOnce(
        mockGetTransferredCaseSuggestionsEmpty,
      );

      const { onOrderUpdate } = renderWithProps();

      await waitForAlert();

      await selectItemInCombobox(order.id, 1);

      let approveButton;
      await waitFor(() => {
        approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
        expect(approveButton).toBeEnabled();
      });
      await userEvent.click(approveButton!);

      let confirmModal: HTMLElement;
      await waitFor(async () => {
        confirmModal = screen.getByTestId(
          `button-confirm-modal-confirmation-modal-${order.id}-submit-button`,
        );
        expect(confirmModal).toBeInTheDocument();
        expect(confirmModal).toBeVisible();
      });
      await userEvent.click(confirmModal!);

      await waitFor(async () => {
        expect(onOrderUpdate).toHaveBeenCalled();
      });

      const expectedInput = {
        caseId: order.caseId,
        id: order.id,
        newCase: toCaseSummary,
        orderType: 'transfer',
        status: 'approved',
      };

      expect(patchSpy).toHaveBeenCalledWith(expectedInput);
    });

    test('should properly reject when API returns a successful response and a reason is supplied', async () => {
      const patchSpy = vi.spyOn(Api2, 'patchTransferOrderRejection').mockImplementation(() => {
        return Promise.resolve();
      });
      vi.spyOn(Api2, 'getCaseSummary')
        .mockResolvedValueOnce(mockGetCaseSummary)
        .mockResolvedValueOnce(mockGetCaseSummaryForToCase);

      vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValueOnce(
        mockGetTransferredCaseSuggestionsEmpty,
      );

      const { onOrderUpdate } = renderWithProps();
      await waitForCaseEntryForm();

      await selectItemInCombobox(order.id, 1);

      const input = findCaseNumberInput(order.id);
      enterCaseNumber(input, '24-12345');

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

        confirmModal = screen.getByTestId(
          `button-confirm-modal-confirmation-modal-${order.id}-submit-button`,
        );
        expect(confirmModal).toBeInTheDocument();
      });
      fireEvent.click(confirmModal!);

      const rejectedOrder = {
        ...order,
        reason: rejectionValue,
        status: 'rejected',
      };

      await waitFor(async () => {
        expect(onOrderUpdate).toHaveBeenCalledWith(
          {
            message: `Transfer of case ${getCaseNumber(order.caseId)} was rejected.`,
            timeOut: 8,
            type: UswdsAlertStyle.Success,
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

        expect(patchSpy).toHaveBeenCalledWith(expectedInput);
      });
    });

    test('should properly clear rejection reason when modal is closed without submitting rejection', async () => {
      vi.spyOn(Api2, 'getCaseSummary')
        .mockResolvedValueOnce(mockGetCaseSummary)
        .mockResolvedValueOnce(mockGetCaseSummaryForToCase);
      vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValueOnce(
        mockGetTransferredCaseSuggestionsEmpty,
      );

      renderWithProps();
      await waitForCaseEntryForm();

      await selectItemInCombobox(order.id, 1);

      const input = findCaseNumberInput(order.id);
      enterCaseNumber(input, '24-12345');

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
        goBack = screen.getByTestId(
          `button-confirm-modal-confirmation-modal-${order.id}-cancel-button`,
        );
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

    test('should throw error during Approval when API returns an error', async () => {
      const errorMessage = 'Some random error';
      vi.spyOn(Api2, 'getCaseSummary')
        .mockResolvedValueOnce(mockGetCaseSummary)
        .mockResolvedValueOnce(mockGetCaseSummaryForToCase);
      vi.spyOn(Api2, 'patchTransferOrderApproval').mockRejectedValue(new Error(errorMessage));
      vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValueOnce(
        mockGetTransferredCaseSuggestionsEmpty,
      );

      const { onOrderUpdate } = renderWithProps();

      await waitForAlert();

      await selectItemInCombobox(order.id, 1);

      const input = findCaseNumberInput(order.id);
      enterCaseNumber(input, '24-12345');

      let approveButton;
      await waitFor(() => {
        approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
        expect(approveButton).toBeEnabled();
      });
      fireEvent.click(approveButton!);

      let confirmModal: HTMLElement;
      await waitFor(async () => {
        confirmModal = screen.getByTestId(
          `button-confirm-modal-confirmation-modal-${order.id}-submit-button`,
        );
        expect(confirmModal).toBeInTheDocument();
      });
      fireEvent.click(confirmModal!);

      await waitFor(async () => {
        expect(onOrderUpdate).toHaveBeenCalled();
        expect(onOrderUpdate).toHaveBeenCalledWith({
          message: errorMessage,
          timeOut: 8,
          type: UswdsAlertStyle.Error,
        });
      });
    });

    test('should throw error during Rejection when API returns an error', async () => {
      const errorMessage = 'Some random error';
      vi.spyOn(Api2, 'getCaseSummary')
        .mockResolvedValueOnce(mockGetCaseSummary)
        .mockResolvedValueOnce(mockGetCaseSummary)
        .mockResolvedValueOnce(mockGetCaseSummaryForToCase);
      vi.spyOn(Api2, 'patchTransferOrderRejection').mockRejectedValue(new Error(errorMessage));
      vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValueOnce(
        mockGetTransferredCaseSuggestionsEmpty,
      );

      const { onOrderUpdate } = renderWithProps();

      await waitForAlert();

      await selectItemInCombobox(order.id, 1);

      const input = findCaseNumberInput(order.id);
      enterCaseNumber(input, '24-12345');

      let rejectButton;
      await waitFor(() => {
        rejectButton = screen.getByTestId(`button-accordion-reject-button-${order.id}`);
        expect(rejectButton).toBeEnabled();
      });
      fireEvent.click(rejectButton!);

      let confirmModal: HTMLElement;
      await waitFor(async () => {
        confirmModal = screen.getByTestId(
          `button-confirm-modal-confirmation-modal-${order.id}-submit-button`,
        );
        expect(confirmModal).toBeInTheDocument();
      });
      fireEvent.click(confirmModal!);

      await waitFor(async () => {
        expect(onOrderUpdate).toHaveBeenCalled();
        expect(onOrderUpdate).toHaveBeenCalledWith({
          message: errorMessage,
          timeOut: 8,
          type: UswdsAlertStyle.Error,
        });
      });
    });

    test('should leave input fields and data in place when closing the modal without approving', async () => {
      vi.spyOn(Api2, 'getCaseSummary')
        .mockResolvedValueOnce(mockGetCaseSummary)
        .mockResolvedValueOnce(mockGetCaseSummaryForToCase);
      vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValueOnce(
        mockGetTransferredCaseSuggestionsEmpty,
      );

      renderWithProps();
      await waitForCaseEntryForm();

      await selectItemInCombobox(order.id, 1);

      const newUserInput = '24-12345';
      const caseIdInput = findCaseNumberInput(order.id);
      enterCaseNumber(caseIdInput, newUserInput);

      let approveButton;
      await waitFor(() => {
        approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
        expect(approveButton).toBeEnabled();
      });
      fireEvent.click(approveButton!);

      // Use the "go back" link to close the modal.
      let goBack: HTMLElement;
      await waitFor(async () => {
        goBack = screen.getByTestId(
          `button-confirm-modal-confirmation-modal-${order.id}-cancel-button`,
        );
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

    test('should clear form, and disable submission button when the Cancel button is clicked', async () => {
      vi.spyOn(Api2, 'getCaseSummary')
        .mockResolvedValueOnce(mockGetCaseSummary)
        .mockResolvedValue(mockGetCaseSummaryForToCase);
      vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValueOnce(
        mockGetTransferredCaseSuggestions,
      );
      const testCaseNumber = '23-12345';
      renderWithProps();
      await waitFor(() => {
        const caseTable = document.querySelector('#suggested-cases');
        expect(caseTable).toBeInTheDocument();
      });

      const radio = screen.getByTestId('button-radio-case-not-listed-radio-button-click-target');
      fireEvent.click(radio);
      await waitForCaseEntryForm();

      await selectItemInCombobox(order.id, 1);

      let caseIdInput = document.querySelector(`input#new-case-input-${order.id}`);
      expect(caseIdInput).toHaveValue(order.docketSuggestedCaseNumber);

      enterCaseNumber(caseIdInput, '00-00000');
      enterCaseNumber(caseIdInput, '');
      const approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
      await waitFor(async () => {
        expect(approveButton).toBeInTheDocument();
        expect(approveButton).toBeVisible();
        expect(approveButton).toBeDisabled();
      });

      enterCaseNumber(caseIdInput, testCaseNumber);

      let cancelButton: HTMLElement;
      await waitFor(async () => {
        cancelButton = screen.getByTestId(`button-accordion-cancel-button-${order.id}`);
        expect(cancelButton).toBeInTheDocument();
        expect(cancelButton).toBeVisible();
      });

      fireEvent.click(cancelButton!);

      await waitFor(() => {
        caseIdInput = document.querySelector(`input#new-case-input-${order.id}`);
        expect(caseIdInput).toHaveValue(order.docketSuggestedCaseNumber);
      });
    });

    test('should clear input values and disable submission button when the Cancel button is clicked', async () => {
      vi.spyOn(Api2, 'getCaseSummary')
        .mockResolvedValueOnce(mockGetCaseSummary)
        .mockResolvedValue(mockGetCaseSummaryForToCase);
      vi.spyOn(Api2, 'getOrderSuggestions').mockResolvedValueOnce(
        mockGetTransferredCaseSuggestionsEmpty,
      );

      renderWithProps();
      await waitForCaseEntryForm();

      await selectItemInCombobox(order.id, 1);

      let caseIdInput = document.querySelector(`input#new-case-input-${order.id}`);
      expect(caseIdInput).toHaveValue(order.docketSuggestedCaseNumber);

      enterCaseNumber(caseIdInput, '00-00000');
      enterCaseNumber(caseIdInput, '');
      const approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
      await waitFor(async () => {
        expect(approveButton).toBeInTheDocument();
        expect(approveButton).toBeVisible();
        expect(approveButton).toBeDisabled();
      });

      enterCaseNumber(caseIdInput, '23-12345');

      let cancelButton: HTMLElement;
      await waitFor(async () => {
        cancelButton = screen.getByTestId(`button-accordion-cancel-button-${order.id}`);
        expect(cancelButton).toBeInTheDocument();
        expect(cancelButton).toBeVisible();
      });

      fireEvent.click(cancelButton!);

      await waitFor(() => {
        caseIdInput = document.querySelector(`input#new-case-input-${order.id}`);
        expect(caseIdInput).toBeInTheDocument();
        expect(caseIdInput).toHaveValue(order.docketSuggestedCaseNumber);
      });
    });
  });
});
