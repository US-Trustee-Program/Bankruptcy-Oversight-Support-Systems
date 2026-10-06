import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import MockData from '@common/cams/test-utilities/mock-data';
import { TransferOrder } from '@common/cams/orders';
import { getCaseNumber } from '@common/cams/cases';
import Api2 from '@/lib/models/api2';
import { RejectedTransferOrder } from './RejectedTransferOrder';

function renderWithOrder(order: TransferOrder) {
  render(
    <BrowserRouter>
      <RejectedTransferOrder order={order} onOrderUpdate={() => {}} />
    </BrowserRouter>,
  );
}

describe('RejectedTransferOrder', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    vi.spyOn(Api2, 'getCaseSummary').mockResolvedValue({ data: MockData.getCaseSummary() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders the rejection message without a reason when none is given', () => {
    const order = MockData.getTransferOrder({ override: { status: 'rejected', reason: '' } });
    renderWithOrder(order);

    expect(screen.getByText('Rejected Transfer')).toBeInTheDocument();

    const content = screen.getByTestId(`accordion-content-reject-message-${order.caseId}`);
    expect(content).toHaveTextContent(`Rejected transfer of ${getCaseNumber(order.caseId)}.`);
  });

  test('renders the rejection message with a sanitized reason when one is given', () => {
    const order = MockData.getTransferOrder({
      override: { status: 'rejected', reason: 'order is bad' },
    });
    renderWithOrder(order);

    const content = screen.getByTestId(`accordion-content-reject-message-${order.caseId}`);
    expect(content).toHaveTextContent(
      `Rejected transfer of ${getCaseNumber(order.caseId)} for the following reason:order is bad`,
    );
  });

  test('renders the order that was rejected, including the from-case summary', async () => {
    const order = MockData.getTransferOrder({ override: { status: 'rejected', reason: '' } });
    renderWithOrder(order);

    expect(screen.getByText('Order that was Rejected')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId(`transfer-from-case-${order.id}`)).toBeInTheDocument();
    });
  });
});
