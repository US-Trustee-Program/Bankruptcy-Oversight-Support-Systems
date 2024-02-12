import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import {
  OfficeDetails,
  OrderResponseData,
  TransferOrder,
} from '@/lib/type-declarations/chapter-15';
import DataVerificationScreen, { officeSorter } from './DataVerificationScreen';
import { BrowserRouter } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';

describe('Review Orders screen', () => {
  let orders: TransferOrder[];

  beforeAll(async () => {
    const ordersResponse = (await Chapter15MockApi.get('/orders')) as unknown as OrderResponseData;
    orders = ordersResponse.body.filter((o) => o.orderType === 'transfer') as TransferOrder[];
  });

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('should sort offices', () => {
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
    const expectedOffices: OfficeDetails[] = [
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
    ];
    const actualOffices = testOffices.sort(officeSorter);
    expect(actualOffices).toEqual<OfficeDetails[]>(expectedOffices);
  });

  test('should render a list of orders', async () => {
    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    const ordersScreen = screen.getByTestId('data-verification-screen');
    expect(ordersScreen).toBeInTheDocument();

    let accordionGroup;
    await waitFor(() => {
      accordionGroup = screen.getByTestId('accordion-group');
      expect(accordionGroup).toBeInTheDocument();
    });
    const approvedOrderFilter = screen.getByTestId(`order-status-filter-approved`);
    const rejectedOrderFilter = screen.getByTestId(`order-status-filter-rejected`);
    fireEvent.click(approvedOrderFilter);
    fireEvent.click(rejectedOrderFilter);
    for (const order of orders) {
      await waitFor(async () => {
        const heading = screen.getByTestId(`accordion-heading-${order.id}`);
        expect(heading).toBeInTheDocument();
        expect(heading).toBeVisible();
        expect(heading?.textContent).toContain(order.caseTitle);
        expect(heading?.textContent).toContain(getCaseNumber(order.caseId));
        expect(heading?.textContent).toContain(formatDate(order.orderDate));

        const content = screen.getByTestId(`accordion-content-${order.id}`);
        expect(content).toBeInTheDocument();
        expect(content).not.toBeVisible();
        expect(content?.textContent).toContain(order.docketEntries[0]?.summaryText);
        expect(content?.textContent).toContain(order.docketEntries[0]?.fullText);
        if (order.status !== 'approved' && order.status !== 'rejected') {
          const form = screen.getByTestId(`order-form-${order.id}`);
          expect(form).toBeInTheDocument();
          const newCaseIdText = screen.getByTestId(`new-case-input-${order.id}`);
          expect(newCaseIdText).toHaveValue(order.newCaseId);
        }
      });
    }
  });

  test('should toggle filter button', async () => {
    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    const ordersScreen = screen.getByTestId('data-verification-screen');
    expect(ordersScreen).toBeInTheDocument();

    let accordionGroup;
    await waitFor(() => {
      accordionGroup = screen.getByTestId('accordion-group');
      expect(accordionGroup).toBeInTheDocument();
    });
    const approvedOrderFilter = screen.getByTestId(`order-status-filter-approved`);

    act(() => {
      fireEvent.click(approvedOrderFilter);
    });

    await waitFor(() => {
      expect(approvedOrderFilter).toHaveClass('active');
    });

    act(() => {
      fireEvent.click(approvedOrderFilter);
    });

    await waitFor(() => {
      expect(approvedOrderFilter).toHaveClass('inactive');
    });
  });

  test('should not render a list if an API error is encountered', async () => {
    vitest.spyOn(Chapter15MockApi, 'get').mockRejectedValue({});

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    await waitFor(async () => {
      const accordionGroup = screen.getByTestId('accordion-group');
      expect(accordionGroup).toBeInTheDocument();
      expect(accordionGroup.childElementCount).toEqual(0);
    });
  });
});
