import { TransferOrder } from '@/lib/type-declarations/chapter-15';
import { AlertDetails } from './DataVerificationScreen';
import { TransferOrderAccordion, TransferOrderAccordionProps } from './TransferOrderAccordion';
import { BrowserRouter } from 'react-router-dom';
import { screen, fireEvent, render, waitFor } from '@testing-library/react';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { MockInstance } from 'vitest';
import { orderType, orderStatusType } from '@/lib/utils/labels';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { OfficeDetails } from '@common/cams/courts';

describe('Test suggested cases', () => {
  let apiSpy: MockInstance;
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

  const caseLookup = MockData.getCaseSummary();

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
    apiSpy = vi
      .spyOn(Chapter15MockApi, 'get')
      .mockResolvedValue({ success: true, body: [caseLookup] });
    order = MockData.getTransferOrder();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('should call the api to get suggested cases', async () => {
    renderWithProps();

    // select the suggestions button
    const button = document.querySelector('#buttonSuggestedCases');
    fireEvent.click(button!);

    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalled();
    });
  });

  test('should show suggested cases', async () => {
    renderWithProps();

    // select the suggestions button
    const button = document.querySelector('#buttonSuggestedCases');
    fireEvent.click(button!);

    await waitFor(() => {
      const case0 = screen.getByTestId('suggested-cases-row-0');
      expect(case0).toBeInTheDocument();
    });
  });

  test('should show enabled approve button when a suggested case is selected', async () => {
    renderWithProps();

    // select the suggestions button
    const button = document.querySelector('#buttonSuggestedCases');
    fireEvent.click(button!);

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
    const apiSpy = vi.spyOn(Chapter15MockApi, 'get').mockResolvedValue({ success: true, body: [] });

    renderWithProps();

    // select the suggestions button
    const button = document.querySelector('#buttonSuggestedCases');
    fireEvent.click(button!);

    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalled();
    });

    const alertContainer = screen.getByTestId('alert-container-suggested-cases-not-found');
    expect(alertContainer).toBeInTheDocument();
    await waitFor(() => {
      expect(alertContainer).toHaveClass('visible');
    });
  });

  test('should disable approve button when button group is toggled', async () => {
    renderWithProps();

    // select the suggestions button
    const suggestedButton = document.querySelector('#buttonSuggestedCases');
    fireEvent.click(suggestedButton!);

    let case0;
    await waitFor(() => {
      case0 = screen.getByTestId('suggested-cases-radio-0');
      expect(case0).toBeInTheDocument();
    });

    let approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
    expect(approveButton).toBeDisabled();

    if (!case0) throw Error();

    fireEvent.click(case0);

    await waitFor(() => {
      expect(approveButton).toBeEnabled();
    });

    const defaultButton = document.querySelector('#buttonEnterCase');
    fireEvent.click(defaultButton!);

    approveButton = screen.getByTestId(`button-accordion-approve-button-${order.id}`);
    expect(approveButton).toBeDisabled();
  });

  test('should clear radio button selection when the cancel button is pressed', async () => {
    renderWithProps();

    // select the suggestions button
    const suggestedButton = document.querySelector('#buttonSuggestedCases');
    fireEvent.click(suggestedButton!);

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

  test('should pass an error message back to the parent component when the suggestion query fails', async () => {
    const onOrderUpdate = vi.fn((_alertDetails: AlertDetails, _order?: TransferOrder) => {});
    renderWithProps({ onOrderUpdate });

    vi.spyOn(Chapter15MockApi, 'get').mockRejectedValueOnce(new Error('MockError'));

    const suggestedButton = document.querySelector('#buttonSuggestedCases');
    fireEvent.click(suggestedButton!);

    await waitFor(async () => {
      expect(onOrderUpdate).toHaveBeenCalled();
    });
  });
});
