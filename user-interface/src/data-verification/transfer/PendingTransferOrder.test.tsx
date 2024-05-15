import { OfficeDetails } from '@common/cams/courts';
import { TransferOrder } from '@common/cams/orders';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe } from 'vitest';
import {
  PendingTransferOrder,
  PendingTransferOrderProps,
} from '@/data-verification/transfer/PendingTransferOrder';
import { BrowserRouter } from 'react-router-dom';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { selectItemInMockSelect } from '@/lib/components/CamsSelect.mock';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { ResponseData, SimpleResponseData } from '@/lib/type-declarations/api';
import { CaseSummary } from '@common/cams/cases';

// This is a problem because tests are run with CAMSPA11Y=true which causes the app to use the mock API.
import Api from '@/lib/models/api';
// import Api from '@/lib/models/chapter15-mock.api.cases';

vi.mock('../../lib/components/CamsSelect', () => import('../../lib/components/CamsSelect.mock'));

const fromCaseSummary = MockData.getCaseSummary();
const suggestedCases = MockData.buildArray(MockData.getCaseSummary, 2);

async function mockGetCaseSummary(): Promise<SimpleResponseData<CaseSummary>> {
  console.log('MOCKING getCaseSummary', fromCaseSummary);
  return Promise.resolve({ success: true, body: fromCaseSummary });
}

async function mockGetTransferredCaseSuggestions(): Promise<ResponseData<CaseSummary[]>> {
  console.log('MOCKING getTransferredCaseSuggestions', suggestedCases.length);
  return Promise.resolve({ message: 'ok', count: suggestedCases.length, body: suggestedCases });
}

async function mockGetTransferredCaseSuggestionsEmpty(): Promise<ResponseData<CaseSummary[]>> {
  console.log('MOCKING getTransferredCaseSuggestions-Empty', 0);
  return Promise.resolve({ message: 'ok', count: 0, body: [] });
}

const regionMap = new Map();
regionMap.set('02', 'NEW YORK');
const testOffices: OfficeDetails[] = [
  {
    courtDivisionCode: '001',
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
    courtDivisionCode: '003',
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
    courtDivisionCode: '002',
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

describe('PendingTransferOrder component', () => {
  describe('for suggested cases', () => {
    let order: TransferOrder;

    function renderWithProps(props?: Partial<PendingTransferOrderProps>) {
      const onOrderUpdate = vitest.fn();
      const defaultProps: PendingTransferOrderProps = {
        officesList: testOffices,
        order,
        onOrderUpdate,
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
      order = MockData.getTransferOrder();
      vi.spyOn(Api, 'get')
        .mockImplementationOnce(mockGetCaseSummary)
        .mockImplementationOnce(mockGetTransferredCaseSuggestions);
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
        case0 = screen.getByTestId('suggested-cases-radio-0');
        expect(case0).toBeInTheDocument();
      });

      const approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
      expect(approveButton).toBeDisabled();

      if (!case0) throw Error();

      fireEvent.click(case0);

      await waitFor(() => {
        expect(approveButton).toBeEnabled();
      });
    });

    test('should clear radio button selection when the cancel button is pressed', async () => {
      renderWithProps();

      let case0;
      await waitFor(() => {
        case0 = screen.getByTestId('suggested-cases-radio-0');
        expect(case0).toBeInTheDocument();
      });

      let approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
      expect(approveButton).toBeDisabled();

      if (!case0) throw Error();

      fireEvent.click(case0);
      expect(case0).toBeChecked();

      await waitFor(() => {
        expect(approveButton).toBeEnabled();
      });

      const cancelButton = document.querySelector(`#accordion-cancel-button-${order.id}`);
      fireEvent.click(cancelButton!);

      expect(case0).not.toBeChecked();

      approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
      expect(approveButton).toBeDisabled();
    });

    test.skip('should pass an error message back to the parent component when the suggestion query fails', async () => {
      vi.spyOn(Api, 'get')
        .mockImplementationOnce(mockGetCaseSummary)
        .mockRejectedValueOnce(new Error('MockError'));
      const { onOrderUpdate } = renderWithProps();

      await waitFor(async () => {
        expect(onOrderUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('for manually entered court and case number', () => {
    let order: TransferOrder;

    function renderWithProps(props?: Partial<PendingTransferOrderProps>) {
      const onOrderUpdate = vitest.fn();
      const defaultProps: PendingTransferOrderProps = {
        officesList: testOffices,
        order,
        onOrderUpdate,
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

    function findCaseNumberInput(id: string) {
      const caseIdInput = document.querySelector(`input#new-case-input-${id}`);
      expect(caseIdInput).toBeInTheDocument();
      return caseIdInput;
    }

    function enterCaseNumber(caseIdInput: Element | null | undefined, value: string) {
      if (!caseIdInput) throw Error();

      fireEvent.change(caseIdInput!, { target: { value } });
      expect(caseIdInput).toHaveValue(value);

      return caseIdInput;
    }

    async function clickNoListedCaseRadioButton() {
      let caseNotListedRadio: HTMLElement;
      await waitFor(async () => {
        caseNotListedRadio = await screen.findByTestId('suggested-cases-radio-empty');
        expect(caseNotListedRadio).toBeInTheDocument();
      });
      fireEvent.click(caseNotListedRadio!);
      await waitFor(() => {
        expect(caseNotListedRadio).toBeChecked();
      });
    }

    async function waitForAlert() {
      await waitFor(() => {
        const alert = document.querySelector('#suggested-cases-not-found');
        expect(alert).toBeInTheDocument();
      });
    }

    beforeEach(async () => {
      order = MockData.getTransferOrder();
      vi.spyOn(Api, 'get')
        .mockImplementationOnce(mockGetCaseSummary)
        .mockImplementationOnce(mockGetTransferredCaseSuggestionsEmpty);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    test.skip('should show no suggested cases message when no suggestions are available', async () => {
      renderWithProps();

      const alertContainer = document.querySelector('.alert-container');
      expect(alertContainer).toBeInTheDocument();
      screen.debug(alertContainer!);
      // const alertContainer = screen.getByTestId('case-verification');
      // expect(alertContainer).toBeInTheDocument();
      // await waitFor(() => {
      //   expect(alertContainer).toHaveClass('visible');
      // });
    });

    test('should display modal and when Approve is clicked, upon submission of modal should update the status of order to approved', async () => {
      const patchSpy = vi.spyOn(Api, 'patch').mockResolvedValue({
        message: 'Approved',
        count: 1,
        body: {
          dateFiled: order.dateFiled,
          debtor: order.debtor,
        },
      });

      const { onOrderUpdate } = renderWithProps();
      await waitForAlert();

      const selectButtonQuery = `court-selection-${order.id}`;
      screen.debug();
      selectItemInMockSelect(selectButtonQuery, 1);

      const caseNumber = '24-12345';
      const input = findCaseNumberInput(order.id);
      enterCaseNumber(input, caseNumber);

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
        expect(confirmModal).toBeVisible();
      });
      fireEvent.click(confirmModal!);

      await waitFor(async () => {
        expect(onOrderUpdate).toHaveBeenCalled();
      });

      const expectedInput = {
        caseId: order.caseId,
        id: order.id,
        newCase: {
          caseId: `${testOffices[0].courtDivisionCode}-${caseNumber}`,
          courtDivisionCode: testOffices[0].courtDivisionCode,
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

    test('should show not found message when a case is not found', async () => {
      renderWithProps();
      await clickNoListedCaseRadioButton();

      let newCaseNumberText;
      await waitFor(async () => {
        newCaseNumberText = findCaseNumberInput(order.id);
        expect(newCaseNumberText).toHaveValue(order.docketSuggestedCaseNumber);
      });

      selectItemInMockSelect(`court-selection-${order.id}`, 1);

      const newValue = '77-77777';
      enterCaseNumber(newCaseNumberText, newValue);

      await waitFor(async () => {
        const validatedCases = screen.queryByTestId(`validated-cases`);
        expect(validatedCases).not.toBeInTheDocument();

        const alert = screen.queryByTestId(`alert-container-validation-not-found`);
        expect(alert).toBeInTheDocument();
      });
    });

    test('should properly reject when API returns a successful response and a reason is supplied', async () => {
      const patchSpy = vi.spyOn(Api, 'patch').mockResolvedValue({
        message: 'Rejected',
        count: 1,
        body: {
          dateFiled: order.dateFiled,
          debtor: order.debtor,
        },
      });

      const { onOrderUpdate } = renderWithProps();
      await clickNoListedCaseRadioButton();

      selectItemInMockSelect(`court-selection-${order.id}`, 1);

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
        status: 'rejected',
        reason: rejectionValue,
      };

      await waitFor(async () => {
        expect(onOrderUpdate).toHaveBeenCalledWith(
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
      renderWithProps();
      await clickNoListedCaseRadioButton();

      selectItemInMockSelect(`court-selection-${order.id}`, 1);

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

    test.skip('should throw error during Approval when API returns an error', async () => {
      const errorMessage = 'Some random error';
      vi.spyOn(Api, 'patch').mockRejectedValue(new Error(errorMessage));

      const { onOrderUpdate } = renderWithProps();

      await waitForAlert();

      selectItemInMockSelect(`court-selection-${order.id}`, 1);

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
          type: UswdsAlertStyle.Error,
          timeOut: 8,
        });
      });
    });

    test.skip('should throw error during Rejection when API returns an error', async () => {
      const errorMessage = 'Some random error';
      vi.spyOn(Api, 'patch').mockRejectedValue(new Error(errorMessage));

      const { onOrderUpdate } = renderWithProps();

      await waitForAlert();

      selectItemInMockSelect(`court-selection-${order.id}`, 1);

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
        console.log(onOrderUpdate.mock.calls);
        expect(onOrderUpdate).toHaveBeenCalled();
        expect(onOrderUpdate).toHaveBeenCalledWith({
          message: errorMessage,
          type: UswdsAlertStyle.Error,
          timeOut: 8,
        });
      });
    });

    test('should leave input fields and data in place when closing the modal without approving', async () => {
      renderWithProps();
      await clickNoListedCaseRadioButton();

      selectItemInMockSelect(`court-selection-${order.id}`, 1);

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

    test('should clear input values and disable submission button when the Cancel button is clicked', async () => {
      renderWithProps();
      await clickNoListedCaseRadioButton();

      selectItemInMockSelect(`court-selection-${order.id}`, 1);

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
        expect(caseIdInput).not.toBeInTheDocument();
      });
    });

    /*
      TODO: Since we are no longer displaying a preview-description, we will need to either rework this
      or if it's not valid, remove the test entirely.
    test('should allow a court to be deselected', async () => {
      renderWithProps();
      await clickNoListedCaseRadioButton();

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
    */

    test('should allow the new case ID to be entered', async () => {
      renderWithProps();
      await clickNoListedCaseRadioButton();

      let newCaseNumberText;
      await waitFor(async () => {
        newCaseNumberText = findCaseNumberInput(order.id);
        expect(newCaseNumberText).toHaveValue(order.docketSuggestedCaseNumber);
      });

      const newValue = '22-33333';
      enterCaseNumber(newCaseNumberText, newValue);

      await waitFor(async () => {
        const newCaseNumberText = screen.getByTestId(`new-case-input-${order.id}`);
        expect(newCaseNumberText).toHaveValue(newValue);
      });
    });

    test('should show a case summary when a case is found', async () => {
      renderWithProps();
      await clickNoListedCaseRadioButton();

      let newCaseNumberText;
      await waitFor(async () => {
        newCaseNumberText = findCaseNumberInput(order.id);
        expect(newCaseNumberText).toHaveValue(order.docketSuggestedCaseNumber);
      });

      selectItemInMockSelect(`court-selection-${order.id}`, 1);

      const newValue = '22-33333';
      enterCaseNumber(newCaseNumberText, newValue);

      await waitFor(async () => {
        const validatedCases = screen.getByTestId(`validated-cases`);
        expect(validatedCases).toBeInTheDocument();

        const alert = screen.queryByTestId(`alert-container-validation-not-found`);
        expect(alert).not.toBeInTheDocument();
      });
    });
  });
});
