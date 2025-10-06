import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import TrusteeDetailAuditHistory, {
  TrusteeDetailAuditHistoryProps,
} from './TrusteeDetailAuditHistory';
import {
  TrusteeHistory,
  TrusteeNameHistory,
  TrusteePublicContactHistory,
  TrusteeSoftwareHistory,
} from '@common/cams/trustees';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import {
  createMockNameHistory,
  createMockPublicContactHistory,
  createMockInternalContactHistory,
  TestScenarios,
  resetMockIdCounter,
} from './test-helpers/trustee-history-factories';

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

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockIdCounter(); // Ensures consistent test IDs
  });

  function renderWithProps(props?: Partial<TrusteeDetailAuditHistoryProps>) {
    const defaultProps: TrusteeDetailAuditHistoryProps = {
      trusteeId: mockTrusteeId,
    };

    const renderProps = { ...defaultProps, ...props };
    render(<TrusteeDetailAuditHistory {...renderProps} />);
  }

  // Using factory functions for base mock data - much cleaner!
  const mockNameHistory = createMockNameHistory();
  const mockPublicContactHistory = createMockPublicContactHistory({
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
  });
  const mockInternalContactHistory = createMockInternalContactHistory();

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
    // Much cleaner using the factory function!
    const contactHistory = TestScenarios.emailOnly();

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistory] });

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
    // Using TestScenarios for edge case
    const contactHistory = TestScenarios.emptyContact();

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistory] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-contact-0')).toHaveTextContent('(none)');
    expect(screen.getByTestId('new-contact-0')).toHaveTextContent('(none)');
  });

  test('should handle missing name fields in name history', async () => {
    // Using TestScenarios for cleaner test data
    const nameHistory = TestScenarios.emptyName();

    mockGetTrusteeHistory.mockResolvedValue({ data: [nameHistory] });

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
    // Using TestScenarios for common edge cases
    const contactHistory = TestScenarios.phoneNoExtension();

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistory] });

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
      id: 'audit-8-id',
      trusteeId: 'audit-8',
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
    // Using TestScenarios for cleaner test data
    const contactHistory = TestScenarios.addressPartial();

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistory] });

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
    // Using TestScenarios for cleaner test data
    const contactHistory = TestScenarios.addressComplete();

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistory] });

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
    // Using TestScenarios for cleaner test data
    const contactHistory = TestScenarios.cityAndState();

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistory] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check individual address elements using CSS classes
    const previousContact = screen.getByTestId('previous-contact-0');

    expect(previousContact.querySelector('.city-state-zip')).toHaveTextContent('Los Angeles, CA');
  });

  test('should handle contact with only state', async () => {
    // Using TestScenarios for cleaner test data
    const contactHistory = TestScenarios.stateOnly();

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistory] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check individual address elements using CSS classes
    const previousContact = screen.getByTestId('previous-contact-0');

    expect(previousContact.querySelector('.city-state-zip')).toHaveTextContent('FL');
  });

  test('should handle contact with only city', async () => {
    // Using TestScenarios for cleaner test data
    const contactHistory = TestScenarios.cityOnly();

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistory] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check individual address elements using CSS classes
    const previousContact = screen.getByTestId('previous-contact-0');

    expect(previousContact.querySelector('.city-state-zip')).toHaveTextContent('Chicago');
  });

  test('should handle contact with undefined address', async () => {
    // Much cleaner using the test scenario!
    const contactHistory = TestScenarios.undefinedAddress();

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistory] });

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
    // Using TestScenarios for cleaner test data
    const contactHistory = TestScenarios.undefinedPhone();

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistory] });

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
    // Using TestScenarios for cleaner test data
    const contactHistory = TestScenarios.phoneNoExtensionUndefined();

    mockGetTrusteeHistory.mockResolvedValue({ data: [contactHistory] });

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
      id: 'audit-17-id',
      trusteeId: 'audit-17',
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
    // Using TestScenarios for cleaner test data
    const nameHistory = TestScenarios.emptyStringName();

    mockGetTrusteeHistory.mockResolvedValue({ data: [nameHistory] });

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

  describe('Bank History Tests', () => {
    const mockBankHistory = {
      id: 'audit-bank-1',
      documentType: 'AUDIT_BANKS' as const,
      before: ['First National Bank', 'Second Trust Bank'],
      after: ['First National Bank', 'Third Community Bank', 'Fourth Federal Bank'],
      updatedOn: '2024-01-20T10:00:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    describe('Bank History empty/undefined/single scenarios', () => {
      const base = { ...mockBankHistory };

      const scenarios = [
        {
          name: 'basic bank change',
          override: {},
          expectPrev: ['First National Bank', 'Second Trust Bank'],
          expectNew: ['First National Bank', 'Third Community Bank', 'Fourth Federal Bank'],
        },
        {
          name: 'no previous banks',
          override: { before: undefined, after: ['New Bank One', 'New Bank Two'] },
          expectPrev: '(none)',
          expectNew: ['New Bank One', 'New Bank Two'],
        },
        {
          name: 'no new banks',
          override: { before: ['Old Bank One', 'Old Bank Two'], after: undefined },
          expectPrev: ['Old Bank One', 'Old Bank Two'],
          expectNew: '(none)',
        },
        {
          name: 'empty arrays',
          override: { before: [], after: [] },
          expectPrev: '(none)',
          expectNew: '(none)',
        },
        {
          name: 'single bank',
          override: { before: ['Single Old Bank'], after: ['Single New Bank'] },
          expectPrev: ['Single Old Bank'],
          expectNew: ['Single New Bank'],
        },
        {
          name: 'missing updatedBy',
          override: { updatedBy: { id: '', name: '' } },
          expectPrev: ['First National Bank', 'Second Trust Bank'],
          expectNew: ['First National Bank', 'Third Community Bank', 'Fourth Federal Bank'],
          expectChangedBy: '',
        },
      ];

      test.each(scenarios)(
        'should display bank history with $name',
        async ({ override, expectPrev, expectNew, expectChangedBy = 'SYSTEM' }) => {
          mockGetTrusteeHistory.mockResolvedValue({ data: [{ ...base, ...override }] });
          renderWithProps({});
          await screen.findByTestId('trustee-history-table');

          const prevEl = screen.getByTestId('previous-banks-0');
          const newEl = screen.getByTestId('new-banks-0');
          const changedByEl = screen.getByTestId('changed-by-0');

          // Helper to assert either array of texts or single string
          const assertContent = (el: HTMLElement, exp: string | string[]) => {
            if (Array.isArray(exp)) {
              exp.forEach((txt) => expect(el).toHaveTextContent(txt));
            } else {
              expect(el).toHaveTextContent(exp);
            }
          };

          assertContent(prevEl, expectPrev);
          assertContent(newEl, expectNew);
          expect(changedByEl).toHaveTextContent(expectChangedBy);
        },
      );
    });

    test('should display mixed history types including banks', async () => {
      const mixedHistory = [mockNameHistory, mockPublicContactHistory, mockBankHistory];

      mockGetTrusteeHistory.mockResolvedValue({ data: mixedHistory });

      renderWithProps({});

      await screen.findByTestId('trustee-history-table');

      // Check that all three types are rendered
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Public Contact')).toBeInTheDocument();
      expect(screen.getByText('Bank(s)')).toBeInTheDocument();

      // Verify bank history data is correct
      const previousBanks = screen.getByTestId('previous-banks-0');
      expect(previousBanks).toHaveTextContent('First National Bank');
      expect(previousBanks).toHaveTextContent('Second Trust Bank');
    });

    test('should render banks as an unordered list', async () => {
      const bankHistoryMultiple = {
        ...mockBankHistory,
        before: ['Bank A', 'Bank B', 'Bank C'],
        after: ['Bank X', 'Bank Y'],
      };

      mockGetTrusteeHistory.mockResolvedValue({ data: [bankHistoryMultiple] });

      renderWithProps({});

      await screen.findByTestId('trustee-history-table');

      // Check that banks are rendered as unordered lists
      const previousBanks = screen.getByTestId('previous-banks-0');
      const newBanks = screen.getByTestId('new-banks-0');

      // Verify unordered lists exist
      expect(previousBanks.querySelector('ul')).toBeInTheDocument();
      expect(newBanks.querySelector('ul')).toBeInTheDocument();

      // Verify list items exist for each bank
      expect(previousBanks.querySelectorAll('li')).toHaveLength(3);
      expect(newBanks.querySelectorAll('li')).toHaveLength(2);

      // Check text content
      expect(previousBanks).toHaveTextContent('Bank A');
      expect(previousBanks).toHaveTextContent('Bank B');
      expect(previousBanks).toHaveTextContent('Bank C');
      expect(newBanks).toHaveTextContent('Bank X');
      expect(newBanks).toHaveTextContent('Bank Y');
    });
  });

  describe('Software History Tests', () => {
    const mockSoftwareHistory: TrusteeSoftwareHistory = {
      id: 'audit-software-1',
      trusteeId: 'audit-software-trustee',
      documentType: 'AUDIT_SOFTWARE',
      before: 'Legacy Software v1.0',
      after: 'Modern Software v2.5',
      updatedOn: '2024-01-21T15:30:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    test('should display software change history correctly', async () => {
      mockGetTrusteeHistory.mockResolvedValue({ data: [mockSoftwareHistory] });

      renderWithProps({});

      await waitFor(() => {
        expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
      });

      // Check software change row
      expect(screen.getByTestId('change-type-software-0')).toHaveTextContent('Software');
      expect(screen.getByTestId('previous-software-0')).toHaveTextContent('Legacy Software v1.0');
      expect(screen.getByTestId('new-software-0')).toHaveTextContent('Modern Software v2.5');
      expect(screen.getByTestId('changed-by-0')).toHaveTextContent('SYSTEM');
      expect(screen.getByTestId('change-date-0')).toHaveTextContent(
        'formatted-2024-01-21T15:30:00Z',
      );
    });

    test('should display (none) for undefined software values', async () => {
      const softwareHistoryWithUndefined = {
        ...mockSoftwareHistory,
        before: undefined,
        after: undefined,
      };

      mockGetTrusteeHistory.mockResolvedValue({ data: [softwareHistoryWithUndefined] });

      renderWithProps({});

      await waitFor(() => {
        expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
      });

      expect(screen.getByTestId('previous-software-0')).toHaveTextContent('(none)');
      expect(screen.getByTestId('new-software-0')).toHaveTextContent('(none)');
    });

    test('should render ShowTrusteeSoftwareHistory component in switch case', async () => {
      mockGetTrusteeHistory.mockResolvedValue({ data: [mockSoftwareHistory] });

      renderWithProps({});

      await waitFor(() => {
        expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
      });

      // Verify the component is rendered correctly - this tests lines 155-162
      expect(screen.getByTestId('change-type-software-0')).toHaveTextContent('Software');
      const softwareRow = screen.getByTestId('change-type-software-0').closest('tr');
      expect(softwareRow).toBeInTheDocument();

      // Verify the specific test IDs that ShowTrusteeSoftwareHistory creates
      expect(screen.getByTestId('previous-software-0')).toBeInTheDocument();
      expect(screen.getByTestId('new-software-0')).toBeInTheDocument();
      expect(screen.getByTestId('changed-by-0')).toBeInTheDocument();
      expect(screen.getByTestId('change-date-0')).toBeInTheDocument();
    });
  });
});
