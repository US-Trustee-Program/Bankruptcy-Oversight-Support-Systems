import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import TrusteeDetailAuditHistory, {
  TrusteeDetailAuditHistoryProps,
} from './TrusteeDetailAuditHistory';
import {
  TrusteeHistory,
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

    // Check individual contact elements using CSS classes
    const previousContact = screen.getByTestId('previous-contact-0');
    const newContact = screen.getByTestId('new-contact-0');

    expect(previousContact.querySelector('.address1')).toHaveTextContent('123 Old St');
    expect(previousContact.querySelector('.city-state-zip')).toHaveTextContent(
      'Old City, NY 12345',
    );
    expect(previousContact.querySelector('.phone')).toHaveTextContent('555-123-4567, ext. 123');
    expect(previousContact.querySelector('.email')).toHaveTextContent('old@example.com');

    expect(newContact.querySelector('.address1')).toHaveTextContent('456 New St');
    expect(newContact.querySelector('.address2')).toHaveTextContent('Suite 100');
    expect(newContact.querySelector('.city-state-zip')).toHaveTextContent('New City, CA 54321');
    expect(newContact.querySelector('.phone')).toHaveTextContent('555-987-6543, ext. 456');
    expect(newContact.querySelector('.email')).toHaveTextContent('new@example.com');
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
      '789 Internal StInternal City, TX 78901555-111-2222internal@example.com',
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

    // Check public contact elements using CSS classes
    const previousContact1 = screen.getByTestId('previous-contact-1');
    expect(previousContact1.querySelector('.address')).toHaveTextContent('123 Old St');
    expect(previousContact1.querySelector('.city-state-zip')).toHaveTextContent(
      'Old City, NY 12345',
    );
    expect(previousContact1.querySelector('.phone')).toHaveTextContent('555-123-4567, ext. 123');
    expect(previousContact1.querySelector('.email')).toHaveTextContent('old@example.com');
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

    // Check individual components of the contact information
    const previousContact = screen.getByTestId('previous-contact-0');
    const newContact = screen.getByTestId('new-contact-0');

    // Previous contact should have email only
    expect(previousContact.querySelector('.email')).toHaveTextContent('email@example.com');
    expect(previousContact.querySelector('.phone')).not.toBeInTheDocument();
    expect(previousContact.querySelector('.address1')).not.toBeInTheDocument();
    expect(previousContact.querySelector('.city-state-zip')).not.toBeInTheDocument();

    // New contact should have phone only
    expect(newContact.querySelector('.phone')).toHaveTextContent('555-123-4567');
    expect(newContact.querySelector('.email')).not.toBeInTheDocument();
    expect(newContact.querySelector('.address1')).not.toBeInTheDocument();
    expect(newContact.querySelector('.city-state-zip')).not.toBeInTheDocument();
  });

  test('should handle completely empty contact information', async () => {
    const contactHistoryEmpty: TrusteePublicContactHistory = {
      id: 'audit-5',
      documentType: 'AUDIT_PUBLIC_CONTACT',
      before: undefined,
      after: undefined,
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

    // Check individual phone elements using CSS classes
    const previousContact = screen.getByTestId('previous-contact-0');
    const newContact = screen.getByTestId('new-contact-0');

    expect(previousContact.querySelector('.phone')).toHaveTextContent('555-123-4567');
    expect(newContact.querySelector('.phone')).toHaveTextContent('555-987-6543');
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

  test('should handle contact with only address1 and zipCode', async () => {
    const contactHistoryPartialAddress: TrusteePublicContactHistory = {
      id: 'audit-9',
      documentType: 'AUDIT_PUBLIC_CONTACT',
      before: createPartialContactInfo({
        address: {
          address1: '123 Main St',
          city: '',
          state: '',
          zipCode: '12345',
          countryCode: 'US',
        },
      }),
      after: createPartialContactInfo({}),
      updatedOn: '2024-01-19T10:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistoryPartialAddress] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check individual address elements using CSS classes
    const previousContact = screen.getByTestId('previous-contact-0');
    const newContact = screen.getByTestId('new-contact-0');

    expect(previousContact.querySelector('.address1')).toHaveTextContent('123 Main St');
    expect(previousContact.querySelector('.city-state-zip')).toHaveTextContent('12345');

    // New contact is empty (createPartialContactInfo({}) creates empty contact object)
    expect(newContact.querySelector('.address1')).not.toBeInTheDocument();
    expect(newContact.querySelector('.city-state-zip')).not.toBeInTheDocument();
    expect(newContact.querySelector('.phone')).not.toBeInTheDocument();
    expect(newContact.querySelector('.email')).not.toBeInTheDocument();
  });

  test('should handle contact with address2 and address3', async () => {
    const contactHistoryWithAllAddressFields: TrusteePublicContactHistory = {
      id: 'audit-10',
      documentType: 'AUDIT_PUBLIC_CONTACT',
      before: createPartialContactInfo({
        address: {
          address1: '123 Main St',
          address2: 'Suite 200',
          address3: 'Building A',
          city: 'Test City',
          state: 'TX',
          zipCode: '78901',
          countryCode: 'US',
        },
      }),
      after: createPartialContactInfo({}),
      updatedOn: '2024-01-19T11:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistoryWithAllAddressFields] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check individual address elements using CSS classes
    const previousContact = screen.getByTestId('previous-contact-0');

    expect(previousContact.querySelector('.address1')).toHaveTextContent('123 Main St');
    expect(previousContact.querySelector('.address2')).toHaveTextContent('Suite 200');
    expect(previousContact.querySelector('.address3')).toHaveTextContent('Building A');
    expect(previousContact.querySelector('.city-state-zip')).toHaveTextContent(
      'Test City, TX 78901',
    );
  });

  test('should handle contact with only city and state', async () => {
    const contactHistoryCityState: TrusteePublicContactHistory = {
      id: 'audit-11',
      documentType: 'AUDIT_PUBLIC_CONTACT',
      before: createPartialContactInfo({
        address: {
          address1: '',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '',
          countryCode: 'US',
        },
      }),
      after: createPartialContactInfo({}),
      updatedOn: '2024-01-19T12:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistoryCityState] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check individual address elements using CSS classes
    const previousContact = screen.getByTestId('previous-contact-0');

    expect(previousContact.querySelector('.city-state-zip')).toHaveTextContent('Los Angeles, CA');
  });

  test('should handle contact with only state', async () => {
    const contactHistoryStateOnly: TrusteePublicContactHistory = {
      id: 'audit-12',
      documentType: 'AUDIT_PUBLIC_CONTACT',
      before: createPartialContactInfo({
        address: {
          address1: '',
          city: '',
          state: 'FL',
          zipCode: '',
          countryCode: 'US',
        },
      }),
      after: createPartialContactInfo({}),
      updatedOn: '2024-01-19T13:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistoryStateOnly] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check individual address elements using CSS classes
    const previousContact = screen.getByTestId('previous-contact-0');

    expect(previousContact.querySelector('.city-state-zip')).toHaveTextContent('FL');
  });

  test('should handle contact with only city', async () => {
    const contactHistoryCityOnly: TrusteePublicContactHistory = {
      id: 'audit-13',
      documentType: 'AUDIT_PUBLIC_CONTACT',
      before: createPartialContactInfo({
        address: {
          address1: '',
          city: 'Chicago',
          state: '',
          zipCode: '',
          countryCode: 'US',
        },
      }),
      after: createPartialContactInfo({}),
      updatedOn: '2024-01-19T14:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistoryCityOnly] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check individual address elements using CSS classes
    const previousContact = screen.getByTestId('previous-contact-0');

    expect(previousContact.querySelector('.city-state-zip')).toHaveTextContent('Chicago');
  });

  test('should handle contact with undefined address', async () => {
    const contactHistoryUndefinedAddress: TrusteePublicContactHistory = {
      id: 'audit-14',
      documentType: 'AUDIT_PUBLIC_CONTACT',
      before: {
        email: 'test@example.com',
        phone: { number: '555-123-4567' },
      } as unknown as ContactInformation,
      after: createPartialContactInfo({}),
      updatedOn: '2024-01-19T15:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistoryUndefinedAddress] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check individual contact elements using CSS classes
    const previousContact = screen.getByTestId('previous-contact-0');

    expect(previousContact.querySelector('.email')).toHaveTextContent('test@example.com');
    expect(previousContact.querySelector('.phone')).toHaveTextContent('555-123-4567');
    expect(previousContact.querySelector('.address')).toBeNull();
  });

  test('should handle contact with undefined phone', async () => {
    const contactHistoryUndefinedPhone: TrusteePublicContactHistory = {
      id: 'audit-15',
      documentType: 'AUDIT_PUBLIC_CONTACT',
      before: {
        email: 'test@example.com',
        phone: undefined,
        address: {
          address1: '123 Test St',
          city: 'Test City',
          state: 'TX',
          zipCode: '12345',
          countryCode: 'US',
        },
      } as ContactInformation,
      after: createPartialContactInfo({}),
      updatedOn: '2024-01-19T16:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistoryUndefinedPhone] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check individual address elements using CSS classes
    const previousContact = screen.getByTestId('previous-contact-0');

    expect(previousContact.querySelector('.email')).toHaveTextContent('test@example.com');
    expect(previousContact.querySelector('.address1')).toHaveTextContent('123 Test St');
    expect(previousContact.querySelector('.city-state-zip')).toHaveTextContent(
      'Test City, TX 12345',
    );
    expect(previousContact.querySelector('.phone')).toBeNull();
  });

  test('should handle contact with phone number but undefined extension', async () => {
    const contactHistoryPhoneNoExtension: TrusteePublicContactHistory = {
      id: 'audit-16',
      documentType: 'AUDIT_PUBLIC_CONTACT',
      before: createPartialContactInfo({
        phone: { number: '555-999-8888', extension: undefined },
      }),
      after: createPartialContactInfo({}),
      updatedOn: '2024-01-19T17:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistoryPhoneNoExtension] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check individual phone elements using CSS classes
    const previousContact = screen.getByTestId('previous-contact-0');

    expect(previousContact.querySelector('.phone')).toHaveTextContent('555-999-8888');
    expect(previousContact.querySelector('.phone')).not.toHaveTextContent('x');
  });

  test('should handle completely undefined contact information', async () => {
    const contactHistoryUndefinedContact: TrusteePublicContactHistory = {
      id: 'audit-17',
      documentType: 'AUDIT_PUBLIC_CONTACT',
      before: undefined,
      after: undefined,
      updatedOn: '2024-01-19T18:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistoryUndefinedContact] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-contact-0')).toHaveTextContent('(none)');
    expect(screen.getByTestId('new-contact-0')).toHaveTextContent('(none)');
  });

  test('should handle empty string in name history', async () => {
    const nameHistoryEmptyStrings: TrusteeNameHistory = {
      id: 'audit-18',
      documentType: 'AUDIT_NAME',
      before: '',
      after: '',
      updatedOn: '2024-01-19T19:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    mockGetTrusteeHistory.mockResolvedValue({ data: [nameHistoryEmptyStrings] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-name-0')).toHaveTextContent('(none)');
    expect(screen.getByTestId('new-name-0')).toHaveTextContent('(none)');
  });

  test('should handle API response with null data', async () => {
    mockGetTrusteeHistory.mockResolvedValue(null);

    renderWithProps({});

    // The component should stay in loading state when response is null
    // because it doesn't set loading to false in that case
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // Wait a bit to ensure the promise resolves and still shows loading
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  test('should handle component unmounting during API call', async () => {
    let resolvePromise: ((value: { data: TrusteeHistory[] }) => void) | undefined;
    const promise = new Promise<{ data: TrusteeHistory[] }>((resolve) => {
      resolvePromise = resolve;
    });

    mockGetTrusteeHistory.mockReturnValue(promise);

    const { unmount } = render(<TrusteeDetailAuditHistory trusteeId={mockTrusteeId} />);

    // Unmount component before API resolves
    unmount();

    // Resolve the promise after unmounting
    resolvePromise?.({ data: [mockNameHistory] });

    // No assertion needed - just ensuring no memory leaks or errors
  });

  test('should render correct component structure with all elements', async () => {
    mockGetTrusteeHistory.mockResolvedValue({ data: [mockNameHistory] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Verify the component structure
    expect(screen.getByText('Change History')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveClass('usa-table', 'usa-table--borderless');

    // Verify table structure
    const table = screen.getByTestId('trustee-history-table');
    expect(table.querySelector('thead')).toBeInTheDocument();
    expect(table.querySelector('tbody')).toBeInTheDocument();

    // Verify all column headers are present
    expect(screen.getByRole('columnheader', { name: 'Change' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'New' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Changed by' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument();
  });
});
