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
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import MockData from '@common/cams/test-utilities/mock-data';
import testingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import { MOCKED_USTP_OFFICES_ARRAY } from '@common/cams/test-utilities/offices.mock';
import * as courtUtils from '@/lib/utils/court-utils';

describe('Review Orders screen', () => {
  function setupFeatureFlags(overrides: Record<string, boolean> = {}) {
    vi.spyOn(FeatureFlagHook, 'default').mockReturnValue({
      'transfer-orders-enabled': true,
      'consolidations-enabled': true,
      'trustee-verification-enabled': false,
      ...overrides,
    });
  }

  beforeEach(async () => {
    testingUtilities.setUser({
      roles: [CamsRole.DataVerifier],
      offices: MOCKED_USTP_OFFICES_ARRAY,
    });
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  test('should call sortByCourtLocation when loading courts', async () => {
    setupFeatureFlags();
    vi.spyOn(Api2, 'getOrders').mockResolvedValue({ data: [] });
    const sortSpy = vi.spyOn(courtUtils, 'sortByCourtLocation');

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(sortSpy).toHaveBeenCalled();
    });

    // Verify it was called with court data
    const callArgs = sortSpy.mock.calls[0];
    expect(callArgs[0]).toBeInstanceOf(Array);
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
    setupFeatureFlags();
    const ordersResponse = {
      data: MockData.getSortedOrders(15),
    };
    vi.spyOn(Api2, 'getOrders').mockResolvedValue(ordersResponse);
    vi.spyOn(Api2, 'getTrusteeVerificationOrders').mockResolvedValue({ data: [] });

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    expect(screen.getByTestId('data-verification-screen')).toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
    });

    const expandBtn = document.querySelector('#task-type-filter-expand') as HTMLElement;
    fireEvent.click(expandBtn);
    fireEvent.click(screen.getByTestId('task-type-filter-option-item-0'));
    fireEvent.click(screen.getByTestId('task-type-filter-option-item-1'));

    await waitFor(() => {
      expect(screen.getByTestId('accordion-group')).toBeInTheDocument();
    });

    for (const order of ordersResponse.data) {
      await waitFor(async () => {
        const heading = screen.getByTestId(`accordion-order-list-${order.id}`);
        expect(heading).toBeInTheDocument();
        expect(heading).toBeVisible();
        expect(heading?.textContent).toContain(order.courtName);
        expect(heading?.textContent).toContain(formatDate(order.orderDate));
      });
    }

    const transferOption = screen.queryByTestId('task-type-filter-option-item-0');
    expect(transferOption).toBeInTheDocument();

    const consolidationOption = screen.queryByTestId('task-type-filter-option-item-1');
    expect(consolidationOption).toBeInTheDocument();
  });

  test('should show "all cases reviewed" alert when order list does not contain pending orders', async () => {
    setupFeatureFlags();
    const ordersResponse = {
      data: [
        MockData.getTransferOrder({ override: { status: 'approved' } }),
        MockData.getConsolidationOrder({
          override: { status: 'approved', leadCase: MockData.getCaseSummary() },
        }),
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

    const expandBtn = document.querySelector('#task-type-filter-expand') as HTMLElement;
    fireEvent.click(expandBtn);
    fireEvent.click(screen.getByTestId('task-type-filter-option-item-0'));
    fireEvent.click(screen.getByTestId('task-type-filter-option-item-1'));

    await waitFor(() => {
      const alert = screen.getByTestId('alert-no-pending-orders');
      expect(alert).toBeInTheDocument();
    });
  });

  test('should show "select filters" alert when a list is empty because filters are applied', async () => {
    setupFeatureFlags();
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
    const statusExpandBtn = document.querySelector('#task-status-filter-expand') as HTMLElement;
    fireEvent.click(statusExpandBtn);
    const rejectedOption = screen.getByTestId('task-status-filter-option-item-2');
    fireEvent.click(rejectedOption);

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

    setupFeatureFlags({ 'consolidations-enabled': false });

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
    });

    const expandBtn = document.querySelector('#task-type-filter-expand') as HTMLElement;
    fireEvent.click(expandBtn);
    fireEvent.click(screen.getByTestId('task-type-filter-option-item-0'));

    await waitFor(() => {
      expect(screen.getByTestId('accordion-group')).toBeInTheDocument();
    });

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

    const transferOption = screen.queryByTestId('task-type-filter-option-item-0');
    expect(transferOption).toBeInTheDocument();

    const consolidationOption = screen.queryByTestId('task-type-filter-option-item-1');
    expect(consolidationOption).not.toBeInTheDocument();
  });

  const sampleVerificationOrder: TrusteeMatchVerification = {
    id: 'case-001:johndoe',
    documentType: 'TRUSTEE_MATCH_VERIFICATION',
    orderType: 'trustee-match',
    caseId: '081-22-11111',
    courtId: '0881',
    status: 'pending',
    mismatchReason: 'HIGH_CONFIDENCE_MATCH',
    dxtrTrustee: { fullName: 'John Doe' },
    matchCandidates: [],
    updatedOn: '2026-01-15T10:00:00.000Z',
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
    createdOn: '2026-01-15T10:00:00.000Z',
    createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
  };

  test('should not call getTrusteeVerificationOrders when flag is off', async () => {
    setupFeatureFlags();
    vi.spyOn(Api2, 'getOrders').mockResolvedValue({ data: [] });
    const verificationSpy = vi.spyOn(Api2, 'getTrusteeVerificationOrders');

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(verificationSpy).not.toHaveBeenCalled();
    });
  });

  test('should call getTrusteeVerificationOrders and render results when flag is on', async () => {
    setupFeatureFlags({ 'trustee-verification-enabled': true });
    vi.spyOn(Api2, 'getOrders').mockResolvedValue({ data: [] });
    vi.spyOn(Api2, 'getTrusteeVerificationOrders').mockResolvedValue({
      data: [sampleVerificationOrder],
    });

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
    });

    const expandBtn = document.querySelector('#task-type-filter-expand') as HTMLElement;
    fireEvent.click(expandBtn);
    fireEvent.click(screen.getByTestId('task-type-filter-option-item-2'));

    await waitFor(() => {
      const accordion = screen.getByTestId(`accordion-order-list-${sampleVerificationOrder.id}`);
      expect(accordion).toBeInTheDocument();
      expect(accordion.textContent).toContain('Trustee Mismatch');
    });
  });

  test('should show "Trustee Match Verification" filter toggle only when flag is on', async () => {
    setupFeatureFlags({ 'trustee-verification-enabled': true });
    vi.spyOn(Api2, 'getOrders').mockResolvedValue({ data: [] });
    vi.spyOn(Api2, 'getTrusteeVerificationOrders').mockResolvedValue({ data: [] });

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    await waitFor(() => {
      const trusteeMismatchOption = screen.getByTestId('task-type-filter-option-item-2');
      expect(trusteeMismatchOption).toBeInTheDocument();
      expect(trusteeMismatchOption.textContent).toContain('Trustee Mismatch');
    });
  });

  test('should hide trustee verification accordion when filter is toggled off', async () => {
    setupFeatureFlags({ 'trustee-verification-enabled': true });
    const transferOrder = MockData.getTransferOrder({ override: { status: 'pending' } });
    vi.spyOn(Api2, 'getOrders').mockResolvedValue({ data: [transferOrder] });
    vi.spyOn(Api2, 'getTrusteeVerificationOrders').mockResolvedValue({
      data: [sampleVerificationOrder],
    });

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
    });

    const expandBtn = document.querySelector('#task-type-filter-expand') as HTMLElement;
    fireEvent.click(expandBtn);
    fireEvent.click(screen.getByTestId('task-type-filter-option-item-0'));
    fireEvent.click(screen.getByTestId('task-type-filter-option-item-2'));

    await waitFor(() => {
      expect(
        screen.getByTestId(`accordion-order-list-${sampleVerificationOrder.id}`),
      ).toBeVisible();
    });

    fireEvent.click(screen.getByTestId('task-type-filter-option-item-2'));

    await waitFor(() => {
      expect(
        screen.getByTestId(`accordion-order-list-${sampleVerificationOrder.id}`),
      ).not.toBeVisible();
    });
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
    setupFeatureFlags();
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

    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
    });

    // Select Transfer type only → only transfers visible.
    const expandBtn = document.querySelector('#task-type-filter-expand') as HTMLElement;
    fireEvent.click(expandBtn);
    const transferOption = screen.getByTestId('task-type-filter-option-item-0');
    fireEvent.click(transferOption);

    await waitFor(async () => {
      for (const order of transferOrders) {
        const heading = screen.queryByTestId(`accordion-order-list-${order.id}`);
        expect(heading).toBeInTheDocument();
        expect(heading).toBeVisible();
      }

      for (const order of consolidationOrders) {
        const heading = screen.queryByTestId(`accordion-order-list-${order.id}`);
        expect(heading).not.toBeVisible();
      }
    });

    // Deselect Transfer, select Consolidation → only consolidations visible.
    fireEvent.click(transferOption);
    const consolidationOption = screen.getByTestId('task-type-filter-option-item-1');
    fireEvent.click(consolidationOption);

    for (const order of consolidationOrders) {
      await waitFor(async () => {
        const heading = screen.queryByTestId(`accordion-order-list-${order.id}`);
        expect(heading).toBeInTheDocument();
        expect(heading).toBeVisible();
      });
    }

    for (const order of transferOrders) {
      await waitFor(async () => {
        const heading = screen.queryByTestId(`accordion-order-list-${order.id}`);
        expect(heading).not.toBeVisible();
      });
    }
  });
});
