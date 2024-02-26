import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { OrderResponseData } from '@/lib/type-declarations/chapter-15';
import DataVerificationScreen, { officeSorter } from './DataVerificationScreen';
import { BrowserRouter } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';
import {
  Order,
  isTransferOrder,
  TransferOrder,
  ConsolidationOrder,
  isConsolidationOrder,
} from '@common/cams/orders';
import { OfficeDetails } from '@common/cams/courts';
import * as FeatureFlagHook from '@/lib/hooks/UseFeatureFlags';

describe('Review Orders screen', () => {
  let orders: Order[];
  let transferOrders: TransferOrder[];
  let consolidationOrders: ConsolidationOrder[];

  beforeAll(async () => {
    const ordersResponse = (await Chapter15MockApi.get('/orders')) as unknown as OrderResponseData;
    orders = ordersResponse.body;
    transferOrders = orders.filter((order) => isTransferOrder(order)) as TransferOrder[];
    consolidationOrders = orders.filter((order) =>
      isConsolidationOrder(order),
    ) as ConsolidationOrder[];
  });

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
    const expectedOffices: OfficeDetails[] = [
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

    // TODO: Move this content checking to a ConsolidationOrderAccordion test.
    for (const order of consolidationOrders) {
      if (order.status === 'pending') {
        const childCaseTable = screen.getByTestId(`${order.id}-case-list`);
        expect(childCaseTable).toBeInTheDocument();
        // TODO: Check for the form elements.
      }
      // TODO: Check for rejected/approved content.
    }

    // TODO: Move this content checking to a TransferORderAccordion test.
    for (const order of transferOrders) {
      await waitFor(async () => {
        const content = screen.getByTestId(`accordion-content-${order.id}`);
        expect(content).toBeInTheDocument();
        expect(content).not.toBeVisible();
        order.docketEntries.forEach((de) => {
          expect(content?.textContent).toContain(de.summaryText);
          expect(content?.textContent).toContain(de.fullText);
        });

        if (order.status === 'pending') {
          const form = screen.getByTestId(`order-form-${order.id}`);
          expect(form).toBeInTheDocument();
          const newCaseIdText = screen.getByTestId(`new-case-input-${order.id}`);
          expect(newCaseIdText).toHaveValue(order.newCaseId);
        }
        // TODO: Check for rejected/approved content.
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

  test('should not show consolidation orders when consolidation feature flag is false', async () => {
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
    const mock = vitest.spyOn(Chapter15MockApi, 'get').mockRejectedValue({});

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

    render(
      <BrowserRouter>
        <DataVerificationScreen />
      </BrowserRouter>,
    );

    // Make sure all the order statuses are visible.
    await waitFor(() => {
      fireEvent.click(screen.getByTestId(`order-status-filter-approved`));
      fireEvent.click(screen.getByTestId(`order-status-filter-rejected`));
    });

    // Check if all the orders are in listed by default.
    for (const order of orders) {
      const heading = screen.queryByTestId(`accordion-order-list-${order.id}`);
      expect(heading).toBeInTheDocument();
    }

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
        expect(heading).not.toBeInTheDocument();
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
        expect(heading).not.toBeInTheDocument();
      });
    }
  });
});
