import { render, screen, waitFor } from '@testing-library/react';
import { BankruptcySoftwareDetailAuditHistory } from './BankruptcySoftwareDetailAuditHistory';
import Api2 from '@/lib/models/api2';
import { BankruptcySoftwareAuditHistory } from '@common/cams/bankruptcy-software';

describe('BankruptcySoftwareDetailAuditHistory', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should display "No changes" message when history is empty', async () => {
    vi.spyOn(Api2, 'getSoftwareHistory').mockResolvedValue({ data: [] });

    render(<BankruptcySoftwareDetailAuditHistory softwareId="sw-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-software-history')).toBeInTheDocument();
      expect(screen.getByText('No changes have been made to this software.')).toBeInTheDocument();
    });
  });

  test('should display history table when history exists', async () => {
    const historyEntries: BankruptcySoftwareAuditHistory[] = [
      {
        id: 'audit-1',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: { name: 'Old Name', status: 'active' },
        after: { name: 'New Name', status: 'active' },
        updatedOn: '2024-06-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ];
    vi.spyOn(Api2, 'getSoftwareHistory').mockResolvedValue({ data: historyEntries });

    render(<BankruptcySoftwareDetailAuditHistory softwareId="sw-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('software-history-table')).toBeInTheDocument();
    });
  });

  test('should show name changes', async () => {
    const historyEntries: BankruptcySoftwareAuditHistory[] = [
      {
        id: 'audit-1',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: { name: 'Old Software Name', status: 'active' },
        after: { name: 'New Software Name', status: 'active' },
        updatedOn: '2024-06-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ];
    vi.spyOn(Api2, 'getSoftwareHistory').mockResolvedValue({ data: historyEntries });

    render(<BankruptcySoftwareDetailAuditHistory softwareId="sw-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('software-change-type-0-0')).toHaveTextContent('Name');
      expect(screen.getByTestId('software-previous-0-0')).toHaveTextContent('Old Software Name');
      expect(screen.getByTestId('software-new-0-0')).toHaveTextContent('New Software Name');
    });
  });

  test('should show status changes', async () => {
    const historyEntries: BankruptcySoftwareAuditHistory[] = [
      {
        id: 'audit-1',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: { name: 'Test Software', status: 'active' },
        after: { name: 'Test Software', status: 'inactive' },
        updatedOn: '2024-06-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ];
    vi.spyOn(Api2, 'getSoftwareHistory').mockResolvedValue({ data: historyEntries });

    render(<BankruptcySoftwareDetailAuditHistory softwareId="sw-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('software-change-type-0-0')).toHaveTextContent('Status');
      expect(screen.getByTestId('software-previous-0-0')).toHaveTextContent('active');
      expect(screen.getByTestId('software-new-0-0')).toHaveTextContent('inactive');
    });
  });

  test('should show "Created" entry when before is null', async () => {
    const historyEntries: BankruptcySoftwareAuditHistory[] = [
      {
        id: 'audit-1',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: null,
        after: { name: 'Brand New Software', status: 'active' },
        updatedOn: '2024-06-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'Admin User' },
      },
    ];
    vi.spyOn(Api2, 'getSoftwareHistory').mockResolvedValue({ data: historyEntries });

    render(<BankruptcySoftwareDetailAuditHistory softwareId="sw-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('software-change-type-0-0')).toHaveTextContent('Created');
      expect(screen.getByTestId('software-previous-0-0')).toHaveTextContent('(none)');
      expect(screen.getByTestId('software-new-0-0')).toHaveTextContent('Brand New Software');
      expect(screen.getByTestId('software-changed-by-0')).toHaveTextContent('Admin User');
    });
  });

  test('should handle API error gracefully', async () => {
    vi.spyOn(Api2, 'getSoftwareHistory').mockRejectedValue(new Error('server error'));

    render(<BankruptcySoftwareDetailAuditHistory softwareId="sw-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-software-history')).toBeInTheDocument();
    });
  });
});
