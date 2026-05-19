import { render, screen, waitFor } from '@testing-library/react';
import { BankDetailAuditHistory } from './BankDetailAuditHistory';
import Api2 from '@/lib/models/api2';
import { BankAuditHistory } from '@common/cams/banks';

describe('BankDetailAuditHistory', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should display "No changes" message when history is empty', async () => {
    vi.spyOn(Api2, 'getBankHistory').mockResolvedValue({ data: [] });

    render(<BankDetailAuditHistory bankId="bank-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-bank-history')).toBeInTheDocument();
      expect(screen.getByText('No changes have been made to this bank.')).toBeInTheDocument();
    });
  });

  test('should display history table when history exists', async () => {
    const historyEntries: BankAuditHistory[] = [
      {
        id: 'audit-1',
        documentType: 'AUDIT_BANK',
        bankId: 'bank-1',
        before: { name: 'Old Name', status: 'active' },
        after: { name: 'New Name', status: 'active' },
        updatedOn: '2024-06-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ];
    vi.spyOn(Api2, 'getBankHistory').mockResolvedValue({ data: historyEntries });

    render(<BankDetailAuditHistory bankId="bank-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('bank-history-table')).toBeInTheDocument();
    });
  });

  test('should show name changes', async () => {
    const historyEntries: BankAuditHistory[] = [
      {
        id: 'audit-1',
        documentType: 'AUDIT_BANK',
        bankId: 'bank-1',
        before: { name: 'Old Bank Name', status: 'active' },
        after: { name: 'New Bank Name', status: 'active' },
        updatedOn: '2024-06-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ];
    vi.spyOn(Api2, 'getBankHistory').mockResolvedValue({ data: historyEntries });

    render(<BankDetailAuditHistory bankId="bank-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('bank-change-type-0-0')).toHaveTextContent('Name');
      expect(screen.getByTestId('bank-previous-0-0')).toHaveTextContent('Old Bank Name');
      expect(screen.getByTestId('bank-new-0-0')).toHaveTextContent('New Bank Name');
    });
  });

  test('should show status changes', async () => {
    const historyEntries: BankAuditHistory[] = [
      {
        id: 'audit-1',
        documentType: 'AUDIT_BANK',
        bankId: 'bank-1',
        before: { name: 'Test Bank', status: 'active' },
        after: { name: 'Test Bank', status: 'inactive' },
        updatedOn: '2024-06-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ];
    vi.spyOn(Api2, 'getBankHistory').mockResolvedValue({ data: historyEntries });

    render(<BankDetailAuditHistory bankId="bank-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('bank-change-type-0-0')).toHaveTextContent('Status');
      expect(screen.getByTestId('bank-previous-0-0')).toHaveTextContent('active');
      expect(screen.getByTestId('bank-new-0-0')).toHaveTextContent('inactive');
    });
  });

  test('should show "Created" entry when before is null', async () => {
    const historyEntries: BankAuditHistory[] = [
      {
        id: 'audit-1',
        documentType: 'AUDIT_BANK',
        bankId: 'bank-1',
        before: null,
        after: { name: 'Brand New Bank', status: 'active' },
        updatedOn: '2024-06-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'Admin User' },
      },
    ];
    vi.spyOn(Api2, 'getBankHistory').mockResolvedValue({ data: historyEntries });

    render(<BankDetailAuditHistory bankId="bank-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('bank-change-type-0-0')).toHaveTextContent('Created');
      expect(screen.getByTestId('bank-previous-0-0')).toHaveTextContent('(none)');
      expect(screen.getByTestId('bank-new-0-0')).toHaveTextContent('Brand New Bank');
      expect(screen.getByTestId('bank-changed-by-0')).toHaveTextContent('Admin User');
    });
  });

  test('should handle API error gracefully', async () => {
    vi.spyOn(Api2, 'getBankHistory').mockRejectedValue(new Error('server error'));

    render(<BankDetailAuditHistory bankId="bank-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-bank-history')).toBeInTheDocument();
    });
  });
});
