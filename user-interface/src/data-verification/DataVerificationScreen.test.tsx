import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DataVerificationScreen from './DataVerificationScreen';
import { BrowserRouter } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';
import {
  isTransferOrder,
  TransferOrder,
  ConsolidationOrder,
  isConsolidationOrder,
} from '@common/cams/orders';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';
import Api2 from '@/lib/models/api2';
import MockData from '@common/cams/test-utilities/mock-data';
import testingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import { MOCKED_USTP_OFFICES_ARRAY } from '@common/cams/test-utilities/offices.mock';

describe('Review Orders screen', () => {
  beforeEach(async () => {
    testingUtilities.setUser({
      roles: [CamsRole.DataVerifier],
      offices: MOCKED_USTP_OFFICES_ARRAY,
    });
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // TODO: Unskip this test.
  test.skip('should toggle filter button', async () => {
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

    fireEvent.click(approvedOrderFilter);

    await waitFor(() => {
      expect(approvedOrderFilter).toHaveClass('active');
    });

    fireEvent.click(approvedOrderFilter);

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
      'transfer-orders-enabled': true,
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
    expect(transfersFilter).toBeInTheDocument();

    const consolidationsFilter = screen.queryByTestId('order-status-filter-consolidation');
    expect(consolidationsFilter).not.toBeInTheDocument();
  });

  test('should render permission invalid error when CaseAssignmentManager is not found in user roles', async () => {
    testingUtilities.setUserWithRoles([]);
    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    expect(screen.getByTestId('alert-container-forbidden-alert')).toBeInTheDocument();
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
    // const mockFeatureFlags = {
    //   'consolidations-enabled': true,
    // };
    // vi.spyOn(FeatureFlagHook, 'default').mockReturnValue(mockFeatureFlags);
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
