import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import TrusteeDetailAuditHistory, {
  TrusteeDetailAuditHistoryProps,
} from './TrusteeDetailAuditHistory';
import {
  TrusteeNameHistory,
  TrusteePublicContactHistory,
  TrusteeInternalContactHistory,
} from '@common/cams/trustees';
import { ContactInformation } from '@common/cams/contact';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

// Mock useApi2 hook
const mockGetTrusteeHistory = vi.fn();
vi.mock('@/lib/hooks/UseApi2', () => ({
  default: () => ({
    getTrusteeHistory: mockGetTrusteeHistory,
  }),
}));

// Mock datetime utility
vi.mock('@/lib/utils/datetime', () => ({
  formatDate: vi.fn((date: string) => `formatted-${date}`),
  sortByDateReverse: vi.fn((a: string, b: string) => b.localeCompare(a)),
}));

describe('TrusteeDetailAuditHistory', () => {
  const mockTrusteeId = '12345';

  // Test helpers for creating properly typed mock data
  const createPartialContactInfo = (fields: Partial<ContactInformation>): ContactInformation => {
    // Create a minimal valid ContactInformation and merge with provided fields
    const base: ContactInformation = {
      address: {
        address1: '',
        city: '',
        state: '',
        zipCode: '',
        countryCode: 'US',
      },
    };

    if (fields.address) {
      base.address = { ...base.address, ...fields.address };
    }
    if (fields.phone) {
      base.phone = fields.phone;
    }
    if (fields.email) {
      base.email = fields.email;
    }

    return base;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderWithProps(props?: Partial<TrusteeDetailAuditHistoryProps>) {
    const defaultProps: TrusteeDetailAuditHistoryProps = {
      trusteeId: mockTrusteeId,
    };

    const renderProps = { ...defaultProps, ...props };
    render(<TrusteeDetailAuditHistory {...renderProps} />);
  }

  const mockNameHistory: TrusteeNameHistory = {
    id: 'audit-1',
    documentType: 'AUDIT_NAME',
    before: 'John Smith',
    after: 'John Doe',
    updatedOn: '2024-01-15T10:00:00Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  const mockPublicContactHistory: TrusteePublicContactHistory = {
    id: 'audit-2',
    documentType: 'AUDIT_PUBLIC_CONTACT',
    before: {
      email: 'old@example.com',
      phone: { number: '555-123-4567', extension: '123' },
      address: {
        address1: '123 Old St',
        address2: '',
        address3: '',
        city: 'Old City',
        state: 'NY',
        zipCode: '12345',
        countryCode: 'US',
      },
    },
    after: {
      email: 'new@example.com',
      phone: { number: '555-987-6543', extension: '456' },
      address: {
        address1: '456 New St',
        address2: 'Suite 100',
        address3: '',
        city: 'New City',
        state: 'CA',
        zipCode: '54321',
        countryCode: 'US',
      },
    },
    updatedOn: '2024-01-16T11:00:00Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  const mockInternalContactHistory: TrusteeInternalContactHistory = {
    id: 'audit-3',
    documentType: 'AUDIT_INTERNAL_CONTACT',
    before: undefined,
    after: {
      email: 'internal@example.com',
      phone: { number: '555-111-2222' },
      address: {
        address1: '789 Internal St',
        address2: '',
        address3: '',
        city: 'Internal City',
        state: 'TX',
        zipCode: '78901',
        countryCode: 'US',
      },
    },
    updatedOn: '2024-01-17T12:00:00Z',
    updatedBy: {
      id: 'user-456',
      name: 'Jane Admin',
    },
  };

  test('should show loading indicator while fetching data', () => {
    mockGetTrusteeHistory.mockReturnValue(new Promise(() => {})); // Never resolves

    renderWithProps({});

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  test('should show empty message when no history is available', async () => {
    mockGetTrusteeHistory.mockResolvedValue({ data: [] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('empty-trustee-history-test-id')).toBeInTheDocument();
    });

    expect(screen.getByText('No changes have been made to this trustee.')).toBeInTheDocument();
    expect(screen.queryByTestId('trustee-history-table')).not.toBeInTheDocument();
  });

  test('should display name change history correctly', async () => {
    mockGetTrusteeHistory.mockResolvedValue({ data: [mockNameHistory] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check table headers
    expect(screen.getByText('Change')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Changed by')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();

    // Check name change row
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByTestId('previous-name-0')).toHaveTextContent('John Smith');
    expect(screen.getByTestId('new-name-0')).toHaveTextContent('John Doe');
    expect(screen.getByTestId('changed-by-0')).toHaveTextContent('SYSTEM');
    expect(screen.getByTestId('change-date-0')).toHaveTextContent('formatted-2024-01-15T10:00:00Z');
  });

  test('should display public contact change history correctly', async () => {
    mockGetTrusteeHistory.mockResolvedValue({ data: [mockPublicContactHistory] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check public contact change row
    expect(screen.getByText('Public Contact')).toBeInTheDocument();
    expect(screen.getByTestId('previous-contact-0')).toHaveTextContent(
      'Email: old@example.com; Phone: 555-123-4567 x123; Address: 123 Old St, Old City, NY 12345',
    );
    expect(screen.getByTestId('new-contact-0')).toHaveTextContent(
      'Email: new@example.com; Phone: 555-987-6543 x456; Address: 456 New St, Suite 100, New City, CA 54321',
    );
    expect(screen.getByTestId('changed-by-0')).toHaveTextContent('SYSTEM');
    expect(screen.getByTestId('change-date-0')).toHaveTextContent('formatted-2024-01-16T11:00:00Z');
  });

  test('should display internal contact change history correctly', async () => {
    mockGetTrusteeHistory.mockResolvedValue({ data: [mockInternalContactHistory] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check internal contact change row
    expect(screen.getByText('Internal Contact')).toBeInTheDocument();
    expect(screen.getByTestId('previous-contact-0')).toHaveTextContent('(none)');
    expect(screen.getByTestId('new-contact-0')).toHaveTextContent(
      'Email: internal@example.com; Phone: 555-111-2222; Address: 789 Internal St, Internal City, TX 78901',
    );
    expect(screen.getByTestId('changed-by-0')).toHaveTextContent('Jane Admin');
    expect(screen.getByTestId('change-date-0')).toHaveTextContent('formatted-2024-01-17T12:00:00Z');
  });

  test('should display multiple history entries sorted by date', async () => {
    const historyData = [mockNameHistory, mockPublicContactHistory, mockInternalContactHistory];
    mockGetTrusteeHistory.mockResolvedValue({ data: historyData });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check that all three rows are rendered
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Public Contact')).toBeInTheDocument();
    expect(screen.getByText('Internal Contact')).toBeInTheDocument();

    // Check that each row has the correct data (order depends on sorting)
    expect(screen.getByTestId('previous-name-2')).toHaveTextContent('John Smith');
    expect(screen.getByTestId('previous-contact-1')).toHaveTextContent('Email: old@example.com');
    expect(screen.getByTestId('previous-contact-0')).toHaveTextContent('(none)');
  });

  test('should handle contact information with missing fields', async () => {
    const contactHistoryWithMissingFields: TrusteePublicContactHistory = {
      id: 'audit-4',
      documentType: 'AUDIT_PUBLIC_CONTACT',
      before: createPartialContactInfo({
        email: 'email@example.com',
      }),
      after: createPartialContactInfo({
        phone: { number: '555-123-4567' },
      }),
      updatedOn: '2024-01-18T13:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistoryWithMissingFields] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-contact-0')).toHaveTextContent('Email: email@example.com');
    expect(screen.getByTestId('new-contact-0')).toHaveTextContent('Phone: 555-123-4567');
  });

  test('should handle completely empty contact information', async () => {
    const contactHistoryEmpty: TrusteePublicContactHistory = {
      id: 'audit-5',
      documentType: 'AUDIT_PUBLIC_CONTACT',
      before: createPartialContactInfo({}),
      after: createPartialContactInfo({}),
      updatedOn: '2024-01-18T13:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistoryEmpty] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-contact-0')).toHaveTextContent('(none)');
    expect(screen.getByTestId('new-contact-0')).toHaveTextContent('(none)');
  });

  test('should handle missing name fields in name history', async () => {
    const nameHistoryWithNulls: TrusteeNameHistory = {
      id: 'audit-6',
      documentType: 'AUDIT_NAME',
      before: undefined,
      after: undefined,
      updatedOn: '2024-01-18T14:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    mockGetTrusteeHistory.mockResolvedValue({ data: [nameHistoryWithNulls] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-name-0')).toHaveTextContent('(none)');
    expect(screen.getByTestId('new-name-0')).toHaveTextContent('(none)');
  });

  test('should handle API error gracefully', async () => {
    mockGetTrusteeHistory.mockRejectedValue(new Error('API Error'));

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('empty-trustee-history-test-id')).toBeInTheDocument();
    });

    expect(screen.getByText('No changes have been made to this trustee.')).toBeInTheDocument();
    expect(screen.queryByTestId('trustee-history-table')).not.toBeInTheDocument();
  });

  test('should call API with correct trustee ID', () => {
    mockGetTrusteeHistory.mockResolvedValue({ data: [] });

    renderWithProps({});

    expect(mockGetTrusteeHistory).toHaveBeenCalledWith(mockTrusteeId);
  });

  test('should handle phone number without extension', async () => {
    const contactHistoryNoExtension: TrusteePublicContactHistory = {
      id: 'audit-7',
      documentType: 'AUDIT_PUBLIC_CONTACT',
      before: createPartialContactInfo({
        phone: { number: '555-123-4567' },
      }),
      after: createPartialContactInfo({
        phone: { number: '555-987-6543' },
      }),
      updatedOn: '2024-01-18T15:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistoryNoExtension] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-contact-0')).toHaveTextContent('Phone: 555-123-4567');
    expect(screen.getByTestId('new-contact-0')).toHaveTextContent('Phone: 555-987-6543');
  });

  test('should handle missing updatedBy field', async () => {
    const historyWithoutUpdatedBy: TrusteeNameHistory = {
      id: 'audit-8',
      documentType: 'AUDIT_NAME',
      before: 'Old Name',
      after: 'New Name',
      updatedOn: '2024-01-18T16:00:00Z',
      updatedBy: { id: '', name: '' }, // Empty user reference instead of undefined
    };

    mockGetTrusteeHistory.mockResolvedValue({ data: [historyWithoutUpdatedBy] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    expect(screen.getByTestId('changed-by-0')).toHaveTextContent('');
  });
});
