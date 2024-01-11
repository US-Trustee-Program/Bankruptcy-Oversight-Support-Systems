import { render, screen, waitFor } from '@testing-library/react';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { OfficeDetails, OrderResponseData } from '@/lib/type-declarations/chapter-15';
import ReviewOrders, { officeSorter } from './ReviewOrdersScreen';
import { BrowserRouter } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';

describe('Review Orders screen', () => {
  let ordersResponse: OrderResponseData;

  beforeAll(async () => {
    ordersResponse = (await Chapter15MockApi.get('/orders')) as unknown as OrderResponseData;
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
        <ReviewOrders />
      </BrowserRouter>,
    );

    const ordersScreen = screen.getByTestId('review-orders-screen');
    expect(ordersScreen).toBeInTheDocument();

    const accordionGroup = screen.getByTestId('accordion-group');
    expect(accordionGroup).toBeInTheDocument();

    for (const order of ordersResponse.body) {
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
        expect(content?.textContent).toContain(order.summaryText);
        expect(content?.textContent).toContain(order.fullText);
        if (order.status !== 'approved') {
          const form = screen.getByTestId(`order-form-${order.id}`);
          expect(form).toBeInTheDocument();
          const newCaseIdText = screen.getByTestId(`new-case-input-${order.id}`);
          expect(newCaseIdText).toHaveValue(order.newCaseId);
        }
      });
    }
  });

  test('should not render a list if an API error is encountered', async () => {
    vitest.spyOn(Chapter15MockApi, 'get').mockRejectedValue({});

    render(
      <BrowserRouter>
        <ReviewOrders />
      </BrowserRouter>,
    );

    await waitFor(async () => {
      const accordionGroup = screen.getByTestId('accordion-group');
      expect(accordionGroup).toBeInTheDocument();
      expect(accordionGroup.childElementCount).toEqual(0);
    });
  });
});
