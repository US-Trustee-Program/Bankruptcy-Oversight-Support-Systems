import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import DataVerificationScreen, { officeSorter } from './DataVerificationScreen';
import { BrowserRouter } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';
import {
  isTransferOrder,
  TransferOrder,
  ConsolidationOrder,
  isConsolidationOrder,
  Order,
} from '@common/cams/orders';
import { OfficeDetails } from '@common/cams/courts';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import { ResponseData } from '@/lib/type-declarations/api';

interface OrderResponseData extends ResponseData<Order> {
  body: Array<Order>;
}

describe('Review Orders screen', () => {
  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  test('should sort offices', () => {
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
    const expectedOffices: OfficeDetails[] = [
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
    ];
    const actualOffices = testOffices.sort(officeSorter);
    expect(actualOffices).toEqual<OfficeDetails[]>(expectedOffices);
  });

  test('should render a list of orders', async () => {
    const ordersResponse = (await Chapter15MockApi.get('/orders')) as unknown as OrderResponseData;
    const orders = ordersResponse.body;

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
        const heading = screen.getByTestId(`accordion-order-list-${order.id}`);
        expect(heading).toBeInTheDocument();
        expect(heading).toBeVisible();
        expect(heading?.textContent).toContain(order.courtName);
        expect(heading?.textContent).toContain(formatDate(order.orderDate));
      });
    }

    const transfersFilter = screen.queryByTestId('order-status-filter-transfer');
    expect(transfersFilter).toBeInTheDocument();

    const consolidationsFilter = screen.queryByTestId('order-status-filter-transfer');
    expect(consolidationsFilter).toBeInTheDocument();
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

  test('should not show consolidation orders when consolidation feature flag is false', async () => {
    const ordersResponse = (await Chapter15MockApi.get('/orders')) as unknown as OrderResponseData;
    const orders = ordersResponse.body;
    const transferOrders = orders.filter((order) => isTransferOrder(order)) as TransferOrder[];
    const consolidationOrders = orders.filter((order) =>
      isConsolidationOrder(order),
    ) as ConsolidationOrder[];

    const mockFeatureFlags = {
      'consolidations-enabled': false,
    };
    vitest.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    let accordionGroup;
    await waitFor(() => {
      accordionGroup = screen.getByTestId('accordion-group');
      expect(accordionGroup).toBeInTheDocument();
    });

    const approvedOrderFilter = screen.getByTestId(`order-status-filter-approved`);
    const rejectedOrderFilter = screen.getByTestId(`order-status-filter-rejected`);
    fireEvent.click(approvedOrderFilter);
    fireEvent.click(rejectedOrderFilter);

    for (const order of transferOrders) {
      await waitFor(() => {
        const heading = screen.getByTestId(`accordion-order-list-${order.id}`);
        expect(heading).toBeInTheDocument();
      });
    }

    consolidationOrders.forEach((order) => {
      const heading = screen.queryByTestId(`accordion-order-list-${order.id}`);
      expect(heading).not.toBeInTheDocument();
    });

    const transfersFilter = screen.queryByTestId('order-status-filter-transfer');
    expect(transfersFilter).not.toBeInTheDocument();

    const consolidationsFilter = screen.queryByTestId('order-status-filter-transfer');
    expect(consolidationsFilter).not.toBeInTheDocument();
  });

  test('should not render a list if an API error is encountered', async () => {
    const mock = vitest.spyOn(Chapter15MockApi, 'get');
    mock.mockRejectedValue({});

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

    mock.mockRestore();
  });

  test('Should filter on type when clicking type filter', async () => {
    const mockFeatureFlags = {
      'consolidations-enabled': true,
    };
    vitest.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
    const ordersResponse = (await Chapter15MockApi.get('/orders')) as unknown as OrderResponseData;
    const orders = ordersResponse.body;
    const transferOrders = orders.filter((order) => isTransferOrder(order)) as TransferOrder[];
    const consolidationOrders = orders.filter((order) =>
      isConsolidationOrder(order),
    ) as ConsolidationOrder[];

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    // Make sure all the order statuses are visible.
    let approveFilter;
    let rejectFilter;

    await waitFor(() => {
      approveFilter = screen.getByTestId(`order-status-filter-approved`);
      rejectFilter = screen.getByTestId(`order-status-filter-rejected`);
    });

    fireEvent.click(approveFilter!);
    fireEvent.click(rejectFilter!);

    await waitFor(() => {
      // Check if all the orders are listed by default.
      for (const order of orders) {
        const heading = screen.queryByTestId(`accordion-order-list-${order.id}`);
        expect(heading).toBeInTheDocument();
      }
    });

    // disabling transfer filter
    let transferFilter: HTMLElement;
    await waitFor(() => {
      transferFilter = screen.getByTestId(`order-status-filter-transfer`);
      expect(transferFilter).toBeInTheDocument();
    });
    fireEvent.click(transferFilter!);

    // make sure only consolidations are visible
    await waitFor(async () => {
      for (const order of transferOrders) {
        const heading = screen.queryByTestId(`accordion-order-list-${order.id}`);
        expect(heading).not.toBeVisible();
      }

      for (const order of consolidationOrders) {
        const heading = screen.queryByTestId(`accordion-order-list-${order.id}`);
        expect(heading).toBeInTheDocument();
        expect(heading).toBeVisible();
      }
    });

    // deselect consolidation filter and select transfer filter
    const consolidationFilter = screen.getByTestId(`order-status-filter-consolidation`);
    expect(consolidationFilter).toBeInTheDocument();
    fireEvent.click(transferFilter!);
    fireEvent.click(consolidationFilter);

    // make sure only transfers are visible
    for (const order of transferOrders) {
      await waitFor(async () => {
        const heading = screen.getByTestId(`accordion-order-list-${order.id}`);
        expect(heading).toBeInTheDocument();
        expect(heading).toBeVisible();
      });
    }

    for (const order of consolidationOrders) {
      await waitFor(async () => {
        const heading = screen.queryByTestId(`accordion-order-list-${order.id}`);
        expect(heading).not.toBeVisible();
      });
    }
  });
});
