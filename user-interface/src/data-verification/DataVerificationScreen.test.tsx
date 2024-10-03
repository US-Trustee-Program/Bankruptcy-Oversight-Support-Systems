import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DataVerificationScreen, { courtSorter } from './DataVerificationScreen';
import { BrowserRouter } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';
import {
  isTransferOrder,
  TransferOrder,
  ConsolidationOrder,
  isConsolidationOrder,
} from '@common/cams/orders';
import { CourtDivisionDetails } from '@common/cams/courts';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import Api2 from '@/lib/models/api2';
import MockData from '@common/cams/test-utilities/mock-data';
import testingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import LocalStorage from '@/lib/utils/local-storage';

describe('Review Orders screen', () => {
  const user = testingUtilities.setUserWithRoles([CamsRole.DataVerifier]);

  beforeEach(async () => {
    LocalStorage.setSession(MockData.getCamsSession({ user }));
    vi.stubEnv('CAMS_PA11Y', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  test('should sort offices', () => {
    const testOffices: CourtDivisionDetails[] = [
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
    const expectedOffices: CourtDivisionDetails[] = [
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
    const actualOffices = testOffices.sort(courtSorter);
    expect(actualOffices).toEqual<CourtDivisionDetails[]>(expectedOffices);
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

  test('should render a list of orders', async () => {
    const ordersResponse = {
      data: MockData.getSortedOrders(15),
    };
    vi.spyOn(Api2, 'getOrders').mockResolvedValue(ordersResponse);

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

    for (const order of ordersResponse.data) {
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

  test('should show "all cases reviewed" alert when order list does not contain pending orders', async () => {
    const ordersResponse = {
      data: [
        MockData.getTransferOrder({ override: { status: 'approved' } }),
        MockData.getConsolidationOrder({ override: { status: 'approved' } }),
      ],
    };
    vi.spyOn(Api2, 'getOrders').mockResolvedValue(ordersResponse);

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    await waitFor(() => {
      const spinner = document.querySelector('.loading-spinner');
      expect(spinner).not.toBeInTheDocument();
    });

    const alert = screen.getByTestId('alert-no-pending-orders');
    expect(alert).toBeInTheDocument();
  });

  test('should show "select filters" alert when a list is empty because filters are applied', async () => {
    const ordersResponse = {
      data: [
        MockData.getTransferOrder({ override: { status: 'approved' } }),
        MockData.getTransferOrder({ override: { status: 'pending' } }),
        MockData.getConsolidationOrder({
          override: { status: 'approved', leadCase: MockData.getCaseSummary() },
        }),
        MockData.getConsolidationOrder({
          override: { status: 'pending', leadCase: MockData.getCaseSummary() },
        }),
      ],
    };
    const mockFeatureFlags = {
      'consolidations-enabled': true,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
    vi.spyOn(Api2, 'getOrders').mockResolvedValue(ordersResponse);

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );
    const loadingSpinner = document.querySelector('.loading-spinner-caption');
    await waitFor(() => {
      expect(loadingSpinner).not.toBeInTheDocument();
    });
    const pendingOrderFilter = screen.getByTestId(`order-status-filter-pending`);
    fireEvent.click(pendingOrderFilter);
    const consolidationOrderFilter = screen.getByTestId(`order-status-filter-consolidation`);
    fireEvent.click(consolidationOrderFilter);
    const transferOrderFilter = screen.getByTestId(`order-status-filter-transfer`);
    fireEvent.click(transferOrderFilter);

    await waitFor(() => {
      const alert = screen.queryByTestId('alert-too-many-filters');
      expect(alert).toBeInTheDocument();
    });

    const header = screen.queryByTestId('orders-header');
    expect(header).not.toBeInTheDocument();
  });

  test('should not show consolidation orders when consolidation feature flag is false', async () => {
    const ordersResponse = {
      data: MockData.getSortedOrders(15),
    };
    vi.spyOn(Api2, 'getOrders').mockResolvedValue(ordersResponse);
    const orders = ordersResponse.data;
    const transferOrders = orders.filter((order) => isTransferOrder(order)) as TransferOrder[];
    const consolidationOrders = orders.filter((order) =>
      isConsolidationOrder(order),
    ) as ConsolidationOrder[];

    const mockFeatureFlags = {
      'consolidations-enabled': false,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
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

  test('should render permission invalid error when CaseAssignmentManager is not found in user roles', async () => {
    testingUtilities.setUserWithRoles([]);
    const unauthorizedUser = MockData.getCamsUser({ roles: [CamsRole.CaseAssignmentManager] });
    LocalStorage.setSession(MockData.getCamsSession({ user: unauthorizedUser }));
    const alertSpy = testingUtilities.spyOnGlobalAlert();
    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    expect(alertSpy.error).toHaveBeenCalledWith('Invalid Permissions');
  });

  test('should not render a list if an API error is encountered', async () => {
    const mock = vi.spyOn(Api2, 'getOrders');
    mock.mockRejectedValue({});

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    await waitFor(async () => {
      const alertContainer = document.querySelector('.usa-alert-container');
      expect(alertContainer).toBeInTheDocument();
    });

    mock.mockRestore();
  });

  test('Should filter on type when clicking type filter', async () => {
    const mockFeatureFlags = {
      'consolidations-enabled': true,
    };
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
    const ordersResponse = {
      data: MockData.getSortedOrders(15),
    };
    vi.spyOn(Api2, 'getOrders').mockResolvedValue(ordersResponse);
    const orders = ordersResponse.data;
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
