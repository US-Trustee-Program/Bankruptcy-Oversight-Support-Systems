import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MockData from '@common/cams/test-utilities/mock-data';
import { TransferOrder } from '@common/cams/orders';
import { getCaseNumber } from '@common/cams/cases';
import Api2 from '@/lib/models/api2';
import { ApprovedTransferOrder } from './ApprovedTransferOrder';

describe('ApprovedTransferOrder', () => {
  let order: TransferOrder;

  beforeEach(() => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    order = MockData.getTransferOrder({ override: { status: 'approved' } });
    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({ data: MockData.getCaseSummary() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders the transfer summary with the from- and to-case details', () => {
    render(
      <BrowserRouter>
        <ApprovedTransferOrder order={order} onOrderUpdate={() => {}} />
      </BrowserRouter>,
    );

    expect(screen.getByText('Verified Transfer')).toBeInTheDocument();

    const actionText = screen.getByTestId(`action-text-${order.id}`);
    expect(actionText).toHaveTextContent(
      `Transferred ${getCaseNumber(order.caseId)} from ${order.courtName} (${order.courtDivisionName}) to ${getCaseNumber(order.newCase?.caseId)} and court ${order.newCase?.courtName} (${order.newCase?.courtDivisionName}).`,
    );
  });

  test('renders the order that was verified, including the from-case summary', async () => {
    render(
      <BrowserRouter>
        <ApprovedTransferOrder order={order} onOrderUpdate={() => {}} />
      </BrowserRouter>,
    );

    expect(screen.getByText('Order that was Verified')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId(`transfer-from-case-${order.id}`)).toBeInTheDocument();
    });
  });
});
