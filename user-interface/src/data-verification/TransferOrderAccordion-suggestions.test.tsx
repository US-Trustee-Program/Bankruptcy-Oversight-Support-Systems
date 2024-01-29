import {
  CaseDetailType,
  OfficeDetails,
  Order,
  OrderResponseData,
} from '@/lib/type-declarations/chapter-15';
import { orderType, statusType } from './DataVerificationScreen';
import { TransferOrderAccordion, TransferOrderAccordionProps } from './TransferOrderAccordion';
import { BrowserRouter } from 'react-router-dom';
import { screen, fireEvent, render, waitFor } from '@testing-library/react';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';

describe('Test suggested cases', () => {
  let order: Order;
  const regionMap = new Map();
  regionMap.set('02', 'NEW YORK');
  const testOffices: OfficeDetails[] = [
    {
      divisionCode: '001',
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
      divisionCode: '003',
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
      divisionCode: '002',
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
      statusType,
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
    const ordersResponse = (await Chapter15MockApi.get('/orders')) as unknown as OrderResponseData;
    order = ordersResponse.body[0];
  });

  afterEach(() => {
    vi.clearAllMocks();
    order = {
      id: '',
      caseId: '',
      caseTitle: '',
      chapter: '',
      courtName: '',
      courtDivisionName: '',
      regionId: '',
      orderType: 'transfer',
      orderDate: '',
      status: 'pending',
      sequenceNumber: 0,
      dateFiled: '',
      summaryText: '',
      fullText: '',
    };
  });

  test('should call the api to get suggested cases', async () => {
    const caseLookup: CaseDetailType = {
      caseId: '',
      chapter: '',
      caseTitle: '',
      officeName: '',
      dateFiled: '',
      assignments: [],
      debtor: {
        name: 'DebtorName',
        ssn: '111-11-1111',
      },
      debtorTypeLabel: '',
      petitionLabel: '',
    };

    const apiSpy = vi
      .spyOn(Chapter15MockApi, 'get')
      .mockResolvedValue({ success: true, body: [caseLookup] });

    renderWithProps();

    // select the suggestions button
    const button = document.querySelector('#buttonnSuggestedCases');
    fireEvent.click(button!);

    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalled();
    });
  });

  test('should show suggested cases', async () => {
    renderWithProps();

    // select the suggestions button
    const button = document.querySelector('#buttonnSuggestedCases');
    fireEvent.click(button!);

    await waitFor(() => {
      const case0 = screen.getByTestId('suggested-cases-row-0');
      expect(case0).toBeInTheDocument();
      const case2 = screen.getByTestId('suggested-cases-row-2');
      expect(case2).toBeInTheDocument();
    });
  });

  test('should show enabled approve button when a suggested case is selected', async () => {
    renderWithProps();

    // select the suggestions button
    const button = document.querySelector('#buttonnSuggestedCases');
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

  test.only('should show no suggested cases message when no suggestions are available', async () => {
    const apiSpy = vi.spyOn(Chapter15MockApi, 'get').mockResolvedValue({ success: true, body: [] });

    renderWithProps();

    // select the suggestions button
    const button = document.querySelector('#buttonnSuggestedCases');
    fireEvent.click(button!);

    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalled();
    });

    const alertContainer = screen.getByTestId('alert-container-suggested-cases-not-found');
    expect(alertContainer).toBeInTheDocument();
    expect(alertContainer).toHaveClass('visible');
  });
});
