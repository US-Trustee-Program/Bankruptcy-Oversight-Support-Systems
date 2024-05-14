import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { OfficeDetails } from '@common/cams/courts';
import { TransferOrder } from '@common/cams/orders';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, MockInstance } from 'vitest';
import {
  PendingTransferOrder,
  PendingTransferOrderProps,
} from '@/data-verification/transfer/PendingTransferOrder';
import { BrowserRouter } from 'react-router-dom';
import { MockData } from '@common/cams/test-utilities/mock-data';

vi.mock('../../lib/components/CamsSelect', () => import('../../lib/components/CamsSelect.mock'));

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

/*
const fromCaseSummary = MockData.getCaseSummary();
const suggestedCases = MockData.buildArray(MockData.getCaseSummary, 2);

async function mockGetCaseSummary(): Promise<SimpleResponseData<CaseSummary>> {
  console.log('MOCKING getCaseSummary', fromCaseSummary);
  return Promise.resolve({ success: true, body: fromCaseSummary });
}

// TODO: Use this for the suggested cases tests
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function mockGetTransferredCaseSuggestions(): Promise<ResponseData<CaseSummary[]>> {
  console.log('MOCKING getTransferredCaseSuggestions', suggestedCases.length);
  return Promise.resolve({ message: 'ok', count: suggestedCases.length, body: suggestedCases });
}

async function mockGetTransferredCaseSuggestionsEmpty(): Promise<ResponseData<CaseSummary[]>> {
  console.log('MOCKING getTransferredCaseSuggestions-Empty', 0);
  return Promise.resolve({ message: 'ok', count: 0, body: [] });
}
*/

describe('PendingTransferOrder component', () => {
  describe('for suggested cases', () => {
    let apiSpy: MockInstance;

    const caseLookup = MockData.getCaseSummary();

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
      apiSpy = vi
        .spyOn(Chapter15MockApi, 'get')
        .mockResolvedValueOnce({
          message: '',
          count: 1,
          body: { dateFiled: order.dateFiled, debtor: order.debtor },
        })
        .mockResolvedValue({ success: true, body: [caseLookup] });

      /*
      // TODO: Use this to remplace CAMS_PALLY mocks... TBD.
      vi.spyOn(Api, 'get')
        .mockImplementationOnce(mockGetCaseSummary)
        .mockImplementationOnce(mockGetTransferredCaseSuggestions);
      */
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    test('should call the api to get suggested cases', async () => {
      renderWithProps();

      await waitFor(() => {
        expect(apiSpy).toHaveBeenCalled();
      });
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

    test('should show no suggested cases message when no suggestions are available', async () => {
      const apiSpy = vi
        .spyOn(Chapter15MockApi, 'get')
        .mockResolvedValueOnce({
          message: '',
          count: 1,
          body: { dateFiled: order.dateFiled, debtor: order.debtor },
        })
        .mockResolvedValue({ success: true, body: [] });

      renderWithProps();

      await waitFor(() => {
        expect(apiSpy).toHaveBeenCalled();
      });

      const alertContainer = screen.getByTestId('alert-container-suggested-cases-not-found');
      expect(alertContainer).toBeInTheDocument();
      await waitFor(() => {
        expect(alertContainer).toHaveClass('visible');
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
      vi.spyOn(Chapter15MockApi, 'get').mockRejectedValueOnce(new Error('MockError'));
      const { onOrderUpdate } = renderWithProps();

      await waitFor(async () => {
        expect(onOrderUpdate).toHaveBeenCalled();
      });
    });
  });
});
