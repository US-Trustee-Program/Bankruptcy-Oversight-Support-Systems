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

  test('should show associated banks changes', async () => {
    const historyEntries: BankruptcySoftwareAuditHistory[] = [
      {
        id: 'audit-1',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: { name: 'Test Software', status: 'active', associatedBanks: [] },
        after: {
          name: 'Test Software',
          status: 'active',
          associatedBanks: [{ bankId: 'bank-1', bankName: 'Chase Bank', status: 'active' }],
        },
        updatedOn: '2024-06-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ];
    vi.spyOn(Api2, 'getSoftwareHistory').mockResolvedValue({ data: historyEntries });

    render(<BankruptcySoftwareDetailAuditHistory softwareId="sw-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('software-change-type-0-0')).toHaveTextContent('Associated Banks');
      expect(screen.getByTestId('software-previous-0-0')).toHaveTextContent('(none)');
      expect(screen.getByTestId('software-new-0-0')).toHaveTextContent('Chase Bank (active)');
    });
  });

  test('should show contact info changes with all fields', async () => {
    const historyEntries: BankruptcySoftwareAuditHistory[] = [
      {
        id: 'audit-1',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: { name: 'Test Software', status: 'active' },
        after: {
          name: 'Test Software',
          status: 'active',
          contact: {
            contactNames: ['John Doe'],
            emails: ['john@example.com'],
            website: 'https://example.com',
            phone: { number: '555-1234', extension: '42' },
            address: {
              address1: '123 Main St',
              address2: 'Suite 100',
              city: 'Springfield',
              state: 'IL',
              zipCode: '62701',
            },
          },
        },
        updatedOn: '2024-06-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ];
    vi.spyOn(Api2, 'getSoftwareHistory').mockResolvedValue({ data: historyEntries });

    render(<BankruptcySoftwareDetailAuditHistory softwareId="sw-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('software-change-type-0-0')).toHaveTextContent('Contact Info');
      expect(screen.getByTestId('software-previous-0-0')).toHaveTextContent('(none)');
      const newCell = screen.getByTestId('software-new-0-0');
      expect(newCell).toHaveTextContent('John Doe');
      expect(newCell).toHaveTextContent('john@example.com');
      expect(newCell).toHaveTextContent('https://example.com');
      expect(newCell).toHaveTextContent('555-1234 x42');
      expect(newCell).toHaveTextContent('123 Main St');
    });
  });

  test('should show contact info with phone number without extension', async () => {
    const historyEntries: BankruptcySoftwareAuditHistory[] = [
      {
        id: 'audit-1',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: { name: 'Test Software', status: 'active' },
        after: {
          name: 'Test Software',
          status: 'active',
          contact: {
            phone: { number: '555-9999' },
          },
        },
        updatedOn: '2024-06-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ];
    vi.spyOn(Api2, 'getSoftwareHistory').mockResolvedValue({ data: historyEntries });

    render(<BankruptcySoftwareDetailAuditHistory softwareId="sw-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('software-new-0-0')).toHaveTextContent('555-9999');
    });
  });

  test('should show "Updated" when before and after are identical', async () => {
    const historyEntries: BankruptcySoftwareAuditHistory[] = [
      {
        id: 'audit-1',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: { name: 'Test Software', status: 'active' },
        after: { name: 'Test Software', status: 'active' },
        updatedOn: '2024-06-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ];
    vi.spyOn(Api2, 'getSoftwareHistory').mockResolvedValue({ data: historyEntries });

    render(<BankruptcySoftwareDetailAuditHistory softwareId="sw-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('software-change-type-0-0')).toHaveTextContent('Updated');
    });
  });

  test('should sort history entries by date descending', async () => {
    const historyEntries: BankruptcySoftwareAuditHistory[] = [
      {
        id: 'audit-1',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: { name: 'First', status: 'active' },
        after: { name: 'Second', status: 'active' },
        updatedOn: '2024-01-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
      {
        id: 'audit-2',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: { name: 'Second', status: 'active' },
        after: { name: 'Third', status: 'active' },
        updatedOn: '2024-06-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ];
    vi.spyOn(Api2, 'getSoftwareHistory').mockResolvedValue({ data: historyEntries });

    render(<BankruptcySoftwareDetailAuditHistory softwareId="sw-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('software-new-0-0')).toHaveTextContent('Third');
      expect(screen.getByTestId('software-new-1-0')).toHaveTextContent('Second');
    });
  });

  test('should show "(none)" when name or status fields are undefined', async () => {
    const historyEntries: BankruptcySoftwareAuditHistory[] = [
      {
        id: 'audit-1',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: {},
        after: { name: 'New Name' },
        updatedOn: '2024-06-02T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
      {
        id: 'audit-2',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: { name: 'Old Name' },
        after: {},
        updatedOn: '2024-06-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
      {
        id: 'audit-3',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: {},
        after: { status: 'active' },
        updatedOn: '2024-05-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ];
    vi.spyOn(Api2, 'getSoftwareHistory').mockResolvedValue({ data: historyEntries });

    render(<BankruptcySoftwareDetailAuditHistory softwareId="sw-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('software-change-type-0-0')).toHaveTextContent('Name');
      expect(screen.getByTestId('software-previous-0-0')).toHaveTextContent('(none)');
      expect(screen.getByTestId('software-new-0-0')).toHaveTextContent('New Name');

      expect(screen.getByTestId('software-change-type-1-0')).toHaveTextContent('Name');
      expect(screen.getByTestId('software-previous-1-0')).toHaveTextContent('Old Name');
      expect(screen.getByTestId('software-new-1-0')).toHaveTextContent('(none)');

      expect(screen.getByTestId('software-change-type-2-0')).toHaveTextContent('Status');
      expect(screen.getByTestId('software-previous-2-0')).toHaveTextContent('(none)');
      expect(screen.getByTestId('software-new-2-0')).toHaveTextContent('active');
    });
  });

  test('should show "(none)" for contact with empty fields', async () => {
    const historyEntries: BankruptcySoftwareAuditHistory[] = [
      {
        id: 'audit-1',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: {
          name: 'Test',
          status: 'active',
          contact: { emails: ['old@example.com'] },
        },
        after: {
          name: 'Test',
          status: 'active',
          contact: { contactNames: [], emails: [], website: '' },
        },
        updatedOn: '2024-06-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ];
    vi.spyOn(Api2, 'getSoftwareHistory').mockResolvedValue({ data: historyEntries });

    render(<BankruptcySoftwareDetailAuditHistory softwareId="sw-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('software-change-type-0-0')).toHaveTextContent('Contact Info');
      expect(screen.getByTestId('software-previous-0-0')).toHaveTextContent('old@example.com');
      expect(screen.getByTestId('software-new-0-0')).toHaveTextContent('(none)');
    });
  });

  test('should show "(none)" when after status is undefined and handle empty address', async () => {
    const historyEntries: BankruptcySoftwareAuditHistory[] = [
      {
        id: 'audit-1',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: { name: 'Test', status: 'active' },
        after: { name: 'Test' },
        updatedOn: '2024-06-02T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
      {
        id: 'audit-2',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: {
          name: 'Test',
          status: 'active',
          contact: { phone: { number: '555-0000' }, address: {} },
        },
        after: {
          name: 'Test',
          status: 'active',
          contact: { phone: { number: '555-1111' }, address: { address1: '', address2: '' } },
        },
        updatedOn: '2024-06-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ];
    vi.spyOn(Api2, 'getSoftwareHistory').mockResolvedValue({ data: historyEntries });

    render(<BankruptcySoftwareDetailAuditHistory softwareId="sw-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('software-change-type-0-0')).toHaveTextContent('Status');
      expect(screen.getByTestId('software-previous-0-0')).toHaveTextContent('active');
      expect(screen.getByTestId('software-new-0-0')).toHaveTextContent('(none)');

      expect(screen.getByTestId('software-change-type-1-0')).toHaveTextContent('Contact Info');
      expect(screen.getByTestId('software-previous-1-0')).toHaveTextContent('555-0000');
      expect(screen.getByTestId('software-new-1-0')).toHaveTextContent('555-1111');
    });
  });

  test('should show empty string for "Created" entry when after name is undefined', async () => {
    const historyEntries: BankruptcySoftwareAuditHistory[] = [
      {
        id: 'audit-1',
        documentType: 'AUDIT_BANKRUPTCY_SOFTWARE',
        softwareId: 'sw-1',
        before: null,
        after: { status: 'active' },
        updatedOn: '2024-06-01T00:00:00.000Z',
        updatedBy: { id: 'user-1', name: 'User One' },
      },
    ];
    vi.spyOn(Api2, 'getSoftwareHistory').mockResolvedValue({ data: historyEntries });

    render(<BankruptcySoftwareDetailAuditHistory softwareId="sw-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('software-change-type-0-0')).toHaveTextContent('Created');
      expect(screen.getByTestId('software-new-0-0')).toHaveTextContent('');
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
