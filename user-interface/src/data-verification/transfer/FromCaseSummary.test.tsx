import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MockData from '@common/cams/test-utilities/mock-data';
import { TransferOrder } from '@common/cams/orders';
import { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Api2 from '@/lib/models/api2';
import { formatDate } from '@/lib/utils/datetime';
import { FromCaseSummary } from './FromCaseSummary';

function renderWithProps(order: TransferOrder, onOrderUpdate: (alert: AlertDetails) => void) {
  render(
    <BrowserRouter>
      <FromCaseSummary order={order} onOrderUpdate={onOrderUpdate} />
    </BrowserRouter>,
  );
}

describe('FromCaseSummary', () => {
  let order: TransferOrder;

  beforeEach(() => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    order = MockData.getTransferOrder();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('shows a loading spinner until the case summary loads, then the from-case table', async () => {
    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({ data: MockData.getCaseSummary() });

    renderWithProps(order, () => {});

    expect(screen.getByTestId(`transfer-from-case-loading-${order.id}`)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId(`transfer-from-case-${order.id}`)).toBeInTheDocument();
    });
    expect(screen.queryByTestId(`transfer-from-case-loading-${order.id}`)).not.toBeInTheDocument();
  });

  test('renders the docket entry summary and full text', async () => {
    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({ data: MockData.getCaseSummary() });

    renderWithProps(order, () => {});

    const docketEntry = order.docketEntries[0];
    await waitFor(() => {
      expect(screen.getByText(docketEntry.fullText)).toBeInTheDocument();
    });

    const link = document.querySelector(
      `a[href*="/case-detail/${order.caseId}/court-docket"]`,
    ) as HTMLElement;
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent(`#${docketEntry.documentNumber}`);
    expect(link).toHaveTextContent(docketEntry.summaryText);
    expect(link).toHaveTextContent(formatDate(order.orderDate));
  });

  test('notifies onOrderUpdate with an error alert when the case summary fails to load', async () => {
    const onOrderUpdate = vi.fn();
    vi.spyOn(Api2, 'getCaseSummary').mockRejectedValue(new Error('summary lookup failed'));

    renderWithProps(order, onOrderUpdate);

    await waitFor(() => {
      expect(onOrderUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'summary lookup failed',
          type: UswdsAlertStyle.Error,
        }),
      );
    });
  });
});
