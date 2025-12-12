import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import TrusteeDetailAuditHistory, {
  TrusteeDetailAuditHistoryProps,
} from './TrusteeDetailAuditHistory';
import Api2 from '@/lib/models/api2';
import {
  TrusteeHistory,
  TrusteeInternalContactHistory,
  TrusteeNameHistory,
  TrusteePublicContactHistory,
  TrusteeSoftwareHistory,
  TrusteeOversightHistory,
} from '@common/cams/trustees';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { ContactInformation } from '@common/cams/contact';
import { OversightRole } from '@common/cams/roles';

// Mock Api2
vi.mock('@/lib/models/api2', () => ({
  default: {
    getTrusteeHistory: vi.fn(),
  },
}));

// Mock datetime utility
vi.mock('@/lib/utils/datetime', () => ({
  formatDate: vi.fn((date: string) => `formatted-${date}`),
  sortByDateReverse: vi.fn((a: string, b: string) => b.localeCompare(a)),
  default: {
    SECOND: 1,
    MINUTE: 60,
    HOUR: 3600,
    DAY: 86400,
    THREE_DAYS: 259200,
  },
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
    vi.mocked(Api2.getTrusteeHistory).mockReturnValue(new Promise(() => {})); // Never resolves

    renderWithProps({});

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  test('should show empty message when no history is available', async () => {
    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('empty-trustee-history-test-id')).toBeInTheDocument();
    });

    expect(screen.getByText('No changes have been made to this trustee.')).toBeInTheDocument();
    expect(screen.queryByTestId('trustee-history-table')).not.toBeInTheDocument();
  });

  test('should display name change history correctly', async () => {
    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [mockNameHistory] });

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
    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [mockPublicContactHistory] });

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
    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [mockInternalContactHistory] });

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
    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: historyData });

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

  // Define types for test expectations
  type ContactExpectation = {
    expectedText?: string;
    expectedElements?: Record<string, string>;
    notExpectedElements?: string[];
  };

  type ContactScenarioExpectation = {
    previousContact?: ContactExpectation;
    newContact?: ContactExpectation;
  };

  const contactScenarioTestCases: readonly [string, () => unknown, ContactScenarioExpectation][] = [
    [
      'contact information with missing fields',
      () => TestScenarios.emailOnly(),
      {
        previousContact: {
          expectedElements: { email: 'email@example.com' },
          notExpectedElements: ['phone', 'address1', 'city-state-zip'],
        },
        newContact: {
          expectedElements: { phone: '555-123-4567' },
          notExpectedElements: ['email', 'address1', 'city-state-zip'],
        },
      },
    ],
    [
      'completely empty contact information',
      () => TestScenarios.emptyContact(),
      {
        previousContact: { expectedText: '(none)' },
        newContact: { expectedText: '(none)' },
      },
    ],
    [
      'phone number without extension',
      () => TestScenarios.phoneNoExtension(),
      {
        previousContact: { expectedElements: { phone: '555-123-4567' } },
        newContact: { expectedElements: { phone: '555-987-6543' } },
      },
    ],
    [
      'contact with only address1 and zipCode',
      () => TestScenarios.addressPartial(),
      {
        previousContact: {
          expectedElements: { address1: '123 Main St', 'city-state-zip': '12345' },
        },
        newContact: {
          notExpectedElements: ['address1', 'city-state-zip', 'phone', 'email'],
        },
      },
    ],
    [
      'contact with address2 and address3',
      () => TestScenarios.addressComplete(),
      {
        previousContact: {
          expectedElements: {
            address1: '123 Main St',
            address2: 'Suite 200',
            address3: 'Building A',
            'city-state-zip': 'Test City, TX 78901',
          },
        },
      },
    ],
    [
      'contact with only city and state',
      () => TestScenarios.cityAndState(),
      {
        previousContact: {
          expectedElements: { 'city-state-zip': 'Los Angeles, CA' },
        },
      },
    ],
    [
      'contact with only state',
      () => TestScenarios.stateOnly(),
      {
        previousContact: {
          expectedElements: { 'city-state-zip': 'FL' },
        },
      },
    ],
    [
      'contact with only city',
      () => TestScenarios.cityOnly(),
      {
        previousContact: {
          expectedElements: { 'city-state-zip': 'Chicago' },
        },
      },
    ],
    [
      'contact with undefined address',
      () => TestScenarios.undefinedAddress(),
      {
        previousContact: {
          expectedElements: { email: 'test@example.com', phone: '555-123-4567' },
          notExpectedElements: ['address'],
        },
      },
    ],
  ];

  test.each(contactScenarioTestCases)(
    'should handle %s',
    async (_scenario, scenarioFactory, expectations) => {
      const contactHistory = scenarioFactory();
      vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({
        data: [contactHistory as TrusteeHistory],
      });

      renderWithProps({});

      await waitFor(() => {
        expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
      });

      // Check previous contact expectations
      if (expectations.previousContact) {
        const previousContact = screen.getByTestId('previous-contact-0');

        if (expectations.previousContact.expectedText) {
          expect(previousContact).toHaveTextContent(expectations.previousContact.expectedText);
        }

        if (expectations.previousContact.expectedElements) {
          Object.entries(expectations.previousContact.expectedElements).forEach(
            ([selector, text]) => {
              expect(previousContact.querySelector(`.${selector}`)).toHaveTextContent(
                text as string,
              );
            },
          );
        }

        if (expectations.previousContact.notExpectedElements) {
          expectations.previousContact.notExpectedElements.forEach((selector: string) => {
            expect(previousContact.querySelector(`.${selector}`)).not.toBeInTheDocument();
          });
        }
      }

      // Check new contact expectations
      if (expectations.newContact) {
        const newContact = screen.getByTestId('new-contact-0');

        if (expectations.newContact.expectedText) {
          expect(newContact).toHaveTextContent(expectations.newContact.expectedText);
        }

        if (expectations.newContact.expectedElements) {
          Object.entries(expectations.newContact.expectedElements).forEach(([selector, text]) => {
            expect(newContact.querySelector(`.${selector}`)).toHaveTextContent(text as string);
          });
        }

        if (expectations.newContact.notExpectedElements) {
          expectations.newContact.notExpectedElements.forEach((selector: string) => {
            expect(newContact.querySelector(`.${selector}`)).not.toBeInTheDocument();
          });
        }
      }
    },
  );

  test('should handle missing name fields in name history', async () => {
    const nameHistory = TestScenarios.emptyName();

    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [nameHistory] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-name-0')).toHaveTextContent('(none)');
    expect(screen.getByTestId('new-name-0')).toHaveTextContent('(none)');
  });

  test('should handle API error gracefully', async () => {
    vi.mocked(Api2.getTrusteeHistory).mockRejectedValue(new Error('API Error'));

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('empty-trustee-history-test-id')).toBeInTheDocument();
    });

    expect(screen.getByText('No changes have been made to this trustee.')).toBeInTheDocument();
    expect(screen.queryByTestId('trustee-history-table')).not.toBeInTheDocument();
  });

  test('should call API with correct trustee ID', async () => {
    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [] });

    renderWithProps({});
    await waitFor(() => {
      expect(Api2.getTrusteeHistory).toHaveBeenCalledWith(mockTrusteeId);
    });
  });

  test('should handle phone number without extension', async () => {
    // Using TestScenarios for common edge cases
    const contactHistory = TestScenarios.phoneNoExtension();

    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [contactHistory] });

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

    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [historyWithoutUpdatedBy] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    expect(screen.getByTestId('changed-by-0')).toHaveTextContent('');
  });

  test('should handle contact with only address1 and zipCode', async () => {
    const contactHistory = TestScenarios.addressPartial();

    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [contactHistory] });

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
    const contactHistory = TestScenarios.addressComplete();

    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [contactHistory] });

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
    const contactHistory = TestScenarios.cityAndState();

    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [contactHistory] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check individual address elements using CSS classes
    const previousContact = screen.getByTestId('previous-contact-0');

    expect(previousContact.querySelector('.city-state-zip')).toHaveTextContent('Los Angeles, CA');
  });

  test('should handle contact with only state', async () => {
    const contactHistory = TestScenarios.stateOnly();

    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [contactHistory] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check individual address elements using CSS classes
    const previousContact = screen.getByTestId('previous-contact-0');

    expect(previousContact.querySelector('.city-state-zip')).toHaveTextContent('FL');
  });

  test('should handle contact with only city', async () => {
    const contactHistory = TestScenarios.cityOnly();

    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [contactHistory] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    // Check individual address elements using CSS classes
    const previousContact = screen.getByTestId('previous-contact-0');

    expect(previousContact.querySelector('.city-state-zip')).toHaveTextContent('Chicago');
  });

  test('should handle contact with undefined address', async () => {
    const contactHistory = TestScenarios.undefinedAddress();

    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [contactHistory] });

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
    const contactHistory = TestScenarios.undefinedPhone();

    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [contactHistory] });

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
    const contactHistory = TestScenarios.phoneNoExtensionUndefined();

    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [contactHistory] });

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

    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [contactHistoryUndefinedContact] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-contact-0')).toHaveTextContent('(none)');
    expect(screen.getByTestId('new-contact-0')).toHaveTextContent('(none)');
  });

  test('should handle empty string in name history', async () => {
    const nameHistory = TestScenarios.emptyStringName();

    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [nameHistory] });

    renderWithProps({});

    await waitFor(() => {
      expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-name-0')).toHaveTextContent('(none)');
    expect(screen.getByTestId('new-name-0')).toHaveTextContent('(none)');
  });

  test('should handle API response with null data', async () => {
    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue(
      null as unknown as { data: TrusteeHistory[] },
    );

    renderWithProps({});

    // Initially should show loading indicator
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    // After API call completes, loading should be false and empty state should show
    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('empty-trustee-history-test-id')).toBeInTheDocument();
  });

  test('should handle component unmounting during API call', async () => {
    let resolvePromise: ((value: { data: TrusteeHistory[] }) => void) | undefined;
    const promise = new Promise<{ data: TrusteeHistory[] }>((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(Api2.getTrusteeHistory).mockReturnValue(promise);

    const { unmount } = render(<TrusteeDetailAuditHistory trusteeId={mockTrusteeId} />);

    // Unmount component before API resolves
    unmount();

    // Resolve the promise after unmounting
    resolvePromise?.({ data: [mockNameHistory] });

    // No assertion needed - just ensuring no memory leaks or errors
  });

  test('should render correct component structure with all elements', async () => {
    vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [mockNameHistory] });

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
          vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({
            data: [{ ...base, ...override } as TrusteeHistory],
          });
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

      vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({
        data: mixedHistory as TrusteeHistory[],
      });

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

      vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({
        data: [bankHistoryMultiple as TrusteeHistory],
      });

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
      vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [mockSoftwareHistory] });

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

      vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [softwareHistoryWithUndefined] });

      renderWithProps({});

      await waitFor(() => {
        expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
      });

      expect(screen.getByTestId('previous-software-0')).toHaveTextContent('(none)');
      expect(screen.getByTestId('new-software-0')).toHaveTextContent('(none)');
    });

    test('should render ShowTrusteeSoftwareHistory component in switch case', async () => {
      vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [mockSoftwareHistory] });

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

  describe('Oversight History Tests', () => {
    const mockOversightHistory: TrusteeOversightHistory = {
      id: 'audit-oversight-1',
      trusteeId: 'audit-oversight-trustee',
      documentType: 'AUDIT_OVERSIGHT',
      before: {
        role: OversightRole.OversightAttorney,
        user: {
          id: 'user-123',
          name: 'John Attorney',
        },
      },
      after: {
        role: OversightRole.OversightAttorney,
        user: {
          id: 'user-456',
          name: 'Jane Attorney',
        },
      },
      updatedOn: '2024-01-22T16:45:00Z',
      updatedBy: SYSTEM_USER_REFERENCE,
    };

    test('should display oversight change history correctly', async () => {
      vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [mockOversightHistory] });

      renderWithProps({});

      await waitFor(() => {
        expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
      });

      // Check oversight change row
      expect(screen.getByTestId('change-type-oversight-0')).toHaveTextContent('Oversight');
      expect(screen.getByTestId('previous-oversight-0')).toHaveTextContent('Attorney');
      expect(screen.getByTestId('previous-oversight-0')).toHaveTextContent('John Attorney');
      expect(screen.getByTestId('new-oversight-0')).toHaveTextContent('Attorney');
      expect(screen.getByTestId('new-oversight-0')).toHaveTextContent('Jane Attorney');
      expect(screen.getByTestId('changed-by-0')).toHaveTextContent('SYSTEM');
      expect(screen.getByTestId('change-date-0')).toHaveTextContent(
        'formatted-2024-01-22T16:45:00Z',
      );
    });

    test('should display (none) for undefined oversight values', async () => {
      const oversightHistoryWithUndefined = {
        ...mockOversightHistory,
        before: null,
        after: null,
      };

      vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({
        data: [oversightHistoryWithUndefined],
      });

      renderWithProps({});

      await waitFor(() => {
        expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
      });

      expect(screen.getByTestId('previous-oversight-0')).toHaveTextContent('(none)');
      expect(screen.getByTestId('new-oversight-0')).toHaveTextContent('(none)');
    });

    test('should display oversight history when previous is null and after has value', async () => {
      const oversightHistoryFromNull = {
        ...mockOversightHistory,
        before: null,
        after: {
          role: OversightRole.OversightAttorney,
          user: {
            id: 'user-789',
            name: 'Bob Attorney',
          },
        },
      };

      vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [oversightHistoryFromNull] });

      renderWithProps({});

      await waitFor(() => {
        expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
      });

      expect(screen.getByTestId('previous-oversight-0')).toHaveTextContent('(none)');
      expect(screen.getByTestId('new-oversight-0')).toHaveTextContent('Attorney');
      expect(screen.getByTestId('new-oversight-0')).toHaveTextContent('Bob Attorney');
    });

    test('should display oversight history when before has value and after is null', async () => {
      const oversightHistoryToNull = {
        ...mockOversightHistory,
        before: {
          role: OversightRole.OversightAttorney,
          user: {
            id: 'user-999',
            name: 'Charlie Attorney',
          },
        },
        after: null,
      };

      vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [oversightHistoryToNull] });

      renderWithProps({});

      await waitFor(() => {
        expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
      });

      expect(screen.getByTestId('previous-oversight-0')).toHaveTextContent('Attorney');
      expect(screen.getByTestId('previous-oversight-0')).toHaveTextContent('Charlie Attorney');
      expect(screen.getByTestId('new-oversight-0')).toHaveTextContent('(none)');
    });

    test('should render ShowTrusteeOversightHistory component in switch case', async () => {
      vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [mockOversightHistory] });

      renderWithProps({});

      await waitFor(() => {
        expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
      });

      // Verify the component is rendered correctly
      expect(screen.getByTestId('change-type-oversight-0')).toHaveTextContent('Oversight');
      const oversightRow = screen.getByTestId('change-type-oversight-0').closest('tr');
      expect(oversightRow).toBeInTheDocument();

      // Verify the specific test IDs that ShowTrusteeOversightHistory creates
      expect(screen.getByTestId('previous-oversight-0')).toBeInTheDocument();
      expect(screen.getByTestId('new-oversight-0')).toBeInTheDocument();
      expect(screen.getByTestId('changed-by-0')).toBeInTheDocument();
      expect(screen.getByTestId('change-date-0')).toBeInTheDocument();
    });

    test('should handle missing updatedBy field in oversight history', async () => {
      const oversightHistoryWithoutUpdatedBy = {
        ...mockOversightHistory,
        updatedBy: { id: '', name: '' }, // Empty user reference
      };

      vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({
        data: [oversightHistoryWithoutUpdatedBy],
      });

      renderWithProps({});

      await waitFor(() => {
        expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
      });

      expect(screen.getByTestId('changed-by-0')).toHaveTextContent('');
    });

    test('should display mixed history types including oversight', async () => {
      const mixedHistory = [mockNameHistory, mockPublicContactHistory, mockOversightHistory];

      vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: mixedHistory });

      renderWithProps({});

      await screen.findByTestId('trustee-history-table');

      // Check that all three types are rendered
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Public Contact')).toBeInTheDocument();
      expect(screen.getByText('Oversight')).toBeInTheDocument();

      // Verify oversight history data is correct (it should be at index 0 due to sorting)
      const previousOversight = screen.getByTestId('previous-oversight-0');
      expect(previousOversight).toHaveTextContent('Attorney');
      expect(previousOversight).toHaveTextContent('John Attorney');
    });

    test('should render oversight with line breaks between role and user name', async () => {
      vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [mockOversightHistory] });

      renderWithProps({});

      await waitFor(() => {
        expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
      });

      // Check that role and name are separated by a line break
      const previousOversight = screen.getByTestId('previous-oversight-0');
      const newOversight = screen.getByTestId('new-oversight-0');

      // Verify both role and user name are present
      expect(previousOversight).toHaveTextContent('Attorney');
      expect(previousOversight).toHaveTextContent('John Attorney');
      expect(newOversight).toHaveTextContent('Attorney');
      expect(newOversight).toHaveTextContent('Jane Attorney');

      // Check that <br> elements are present for line breaks
      expect(previousOversight.querySelector('br')).toBeInTheDocument();
      expect(newOversight.querySelector('br')).toBeInTheDocument();
    });

    describe('Oversight History Scenarios', () => {
      const base = { ...mockOversightHistory };

      const scenarios = [
        {
          name: 'basic oversight change',
          override: {},
          expectPrevRole: 'Attorney',
          expectPrevName: 'John Attorney',
          expectNewRole: 'Attorney',
          expectNewName: 'Jane Attorney',
          expectChangedBy: 'SYSTEM',
        },
        {
          name: 'no previous oversight',
          override: {
            before: null,
            after: {
              role: OversightRole.OversightAttorney,
              user: { id: 'user-new', name: 'New Attorney' },
            },
          },
          expectPrev: '(none)',
          expectNewRole: 'Attorney',
          expectNewName: 'New Attorney',
          expectChangedBy: 'SYSTEM',
        },
        {
          name: 'no new oversight',
          override: {
            before: {
              role: OversightRole.OversightAttorney,
              user: { id: 'user-old', name: 'Old Attorney' },
            },
            after: null,
          },
          expectPrevRole: 'Attorney',
          expectPrevName: 'Old Attorney',
          expectNew: '(none)',
          expectChangedBy: 'SYSTEM',
        },
        {
          name: 'both oversight values null',
          override: { before: null, after: null },
          expectPrev: '(none)',
          expectNew: '(none)',
          expectChangedBy: 'SYSTEM',
        },
        {
          name: 'missing updatedBy',
          override: { updatedBy: { id: '', name: '' } },
          expectPrevRole: 'Attorney',
          expectPrevName: 'John Attorney',
          expectNewRole: 'Attorney',
          expectNewName: 'Jane Attorney',
          expectChangedBy: '',
        },
      ];

      test.each(scenarios)(
        'should display oversight history with $name',
        async ({
          override,
          expectPrev,
          expectNew,
          expectPrevRole,
          expectPrevName,
          expectNewRole,
          expectNewName,
          expectChangedBy,
        }) => {
          vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: [{ ...base, ...override }] });
          renderWithProps({});
          await screen.findByTestId('trustee-history-table');

          const prevEl = screen.getByTestId('previous-oversight-0');
          const newEl = screen.getByTestId('new-oversight-0');
          const changedByEl = screen.getByTestId('changed-by-0');

          // Helper to assert either (none) or role/name combination
          if (expectPrev) {
            expect(prevEl).toHaveTextContent(expectPrev);
          } else {
            expect(prevEl).toHaveTextContent(expectPrevRole!);
            expect(prevEl).toHaveTextContent(expectPrevName!);
          }

          if (expectNew) {
            expect(newEl).toHaveTextContent(expectNew);
          } else {
            expect(newEl).toHaveTextContent(expectNewRole!);
            expect(newEl).toHaveTextContent(expectNewName!);
          }

          expect(changedByEl).toHaveTextContent(expectChangedBy);
        },
      );
    });

    test('should display role as-is when role is not in roleDisplayMap', async () => {
      const mockOversightHistoryUnknownRole: TrusteeOversightHistory = {
        id: 'audit-oversight-unknown',
        trusteeId: 'audit-oversight-trustee',
        documentType: 'AUDIT_OVERSIGHT',
        before: {
          role: 'unknown-role' as OversightRole,
          user: {
            id: 'user-before',
            name: 'John Unknown',
          },
        },
        after: {
          role: 'another-unknown-role' as OversightRole,
          user: {
            id: 'user-after',
            name: 'Jane Unknown',
          },
        },
        updatedOn: '2024-01-15T12:00:00Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      };

      vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({
        data: [mockOversightHistoryUnknownRole],
      });

      renderWithProps({});

      await waitFor(() => {
        expect(screen.getByTestId('trustee-history-table')).toBeInTheDocument();
      });

      // Check that unknown roles are displayed as-is (fallback behavior)
      expect(screen.getByTestId('previous-oversight-0')).toHaveTextContent('unknown-role');
      expect(screen.getByTestId('previous-oversight-0')).toHaveTextContent('John Unknown');
      expect(screen.getByTestId('new-oversight-0')).toHaveTextContent('another-unknown-role');
      expect(screen.getByTestId('new-oversight-0')).toHaveTextContent('Jane Unknown');
    });
  });

  describe('RenderTrusteeHistory Integration Tests', () => {
    test('should render all history types through RenderTrusteeHistory component', async () => {
      const mockBankHistory = {
        id: 'audit-bank-1',
        trusteeId: 'trustee-1',
        documentType: 'AUDIT_BANKS' as const,
        before: ['Bank A'],
        after: ['Bank B'],
        updatedOn: '2024-01-20T10:00:00Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      };

      const mockSoftwareHistory: TrusteeSoftwareHistory = {
        id: 'audit-software-1',
        trusteeId: 'trustee-1',
        documentType: 'AUDIT_SOFTWARE',
        before: 'Software A',
        after: 'Software B',
        updatedOn: '2024-01-21T15:30:00Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      };

      const mockOversightHistory: TrusteeOversightHistory = {
        id: 'audit-oversight-1',
        trusteeId: 'trustee-1',
        documentType: 'AUDIT_OVERSIGHT',
        before: {
          role: OversightRole.OversightAttorney,
          user: { id: 'user-1', name: 'Attorney A' },
        },
        after: {
          role: OversightRole.OversightAttorney,
          user: { id: 'user-2', name: 'Attorney B' },
        },
        updatedOn: '2024-01-22T16:45:00Z',
        updatedBy: SYSTEM_USER_REFERENCE,
      };

      const allHistoryTypes = [
        mockNameHistory,
        mockPublicContactHistory,
        mockInternalContactHistory,
        mockBankHistory,
        mockSoftwareHistory,
        mockOversightHistory,
      ];

      vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: allHistoryTypes });

      renderWithProps({});

      await screen.findByTestId('trustee-history-table');

      // Verify all history types are rendered through RenderTrusteeHistory
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Public Contact')).toBeInTheDocument();
      expect(screen.getByText('Internal Contact')).toBeInTheDocument();
      expect(screen.getByText('Bank(s)')).toBeInTheDocument();
      expect(screen.getByText('Software')).toBeInTheDocument();
      expect(screen.getByText('Oversight')).toBeInTheDocument();

      // Verify that each component renders its specific data correctly
      expect(screen.getByTestId('previous-name-5')).toHaveTextContent('John Smith');
      expect(screen.getByTestId('previous-banks-2')).toHaveTextContent('Bank A');
      expect(screen.getByTestId('previous-software-1')).toHaveTextContent('Software A');
      expect(screen.getByTestId('previous-oversight-0')).toHaveTextContent('Attorney A');
    });

    test('should handle switch case default correctly for unknown document types', async () => {
      // This test ensures the switch statement in RenderTrusteeHistory handles all cases
      const validHistoryTypes = [
        createMockNameHistory(),
        createMockPublicContactHistory(),
        createMockInternalContactHistory(),
        {
          id: 'audit-bank-1',
          trusteeId: 'trustee-1',
          documentType: 'AUDIT_BANKS' as const,
          before: ['Bank A'],
          after: ['Bank B'],
          updatedOn: '2024-01-20T10:00:00Z',
          updatedBy: SYSTEM_USER_REFERENCE,
        },
        {
          id: 'audit-software-1',
          trusteeId: 'trustee-1',
          documentType: 'AUDIT_SOFTWARE',
          before: 'Software A',
          after: 'Software B',
          updatedOn: '2024-01-21T15:30:00Z',
          updatedBy: SYSTEM_USER_REFERENCE,
        } as TrusteeSoftwareHistory,
        {
          id: 'audit-oversight-1',
          trusteeId: 'trustee-1',
          documentType: 'AUDIT_OVERSIGHT',
          before: {
            role: OversightRole.OversightAttorney,
            user: { id: 'user-1', name: 'Attorney A' },
          },
          after: null,
          updatedOn: '2024-01-22T16:45:00Z',
          updatedBy: SYSTEM_USER_REFERENCE,
        } as TrusteeOversightHistory,
      ];

      vi.mocked(Api2.getTrusteeHistory).mockResolvedValue({ data: validHistoryTypes });

      renderWithProps({});

      await screen.findByTestId('trustee-history-table');

      // Verify all components render without errors
      expect(screen.getAllByRole('row')).toHaveLength(7); // 6 data rows + 1 header row
    });
  });
});

/**
 * Factory functions for creating trustee history mock data with sensible defaults
 * and easy overrides. Supports undefined/null values for edge case testing.
 */

// Base contact information templates
const BASE_PUBLIC_CONTACT: ContactInformation = {
  email: 'test@example.com',
  phone: { number: '555-123-4567', extension: '123' },
  address: {
    address1: '123 Test St',
    address2: 'Suite 100',
    address3: '',
    city: 'Test City',
    state: 'NY',
    zipCode: '12345',
    countryCode: 'US',
  },
};

const BASE_INTERNAL_CONTACT: ContactInformation = {
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
};

// Counter for unique IDs in tests
let mockIdCounter = 1;

/**
 * Creates a TrusteeNameHistory object with sensible defaults
 */
function createMockNameHistory(overrides: Partial<TrusteeNameHistory> = {}): TrusteeNameHistory {
  const id = mockIdCounter++;
  return {
    id: `audit-${id}-id`,
    trusteeId: `audit-${id}`,
    documentType: 'AUDIT_NAME',
    before: 'John Smith',
    after: 'John Doe',
    updatedOn: '2024-01-15T10:00:00Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    ...overrides,
  };
}

/**
 * Creates a TrusteePublicContactHistory object with sensible defaults
 * Use `before: undefined` or `after: undefined` to test edge cases
 */
function createMockPublicContactHistory(
  overrides: Partial<TrusteePublicContactHistory> = {},
): TrusteePublicContactHistory {
  const id = mockIdCounter++;
  const base: TrusteePublicContactHistory = {
    id: `audit-${id}-id`,
    trusteeId: `audit-${id}`,
    documentType: 'AUDIT_PUBLIC_CONTACT',
    before: { ...BASE_PUBLIC_CONTACT },
    after: {
      ...BASE_PUBLIC_CONTACT,
      email: 'updated@example.com',
      address: {
        ...BASE_PUBLIC_CONTACT.address,
        address1: '456 Updated St',
        city: 'Updated City',
      },
    },
    updatedOn: '2024-01-16T11:00:00Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  return { ...base, ...overrides };
}

/**
 * Creates a TrusteeInternalContactHistory object with sensible defaults
 */
function createMockInternalContactHistory(
  overrides: Partial<TrusteeInternalContactHistory> = {},
): TrusteeInternalContactHistory {
  const id = mockIdCounter++;
  return {
    id: `audit-${id}-id`,
    trusteeId: `audit-${id}`,
    documentType: 'AUDIT_INTERNAL_CONTACT',
    before: undefined,
    after: { ...BASE_INTERNAL_CONTACT },
    updatedOn: '2024-01-17T12:00:00Z',
    updatedBy: {
      id: 'user-456',
      name: 'Jane Admin',
    },
    ...overrides,
  };
}

/**
 * Helper function to create partial contact information for edge case testing
 * This replaces the existing createPartialContactInfo function
 */
function createPartialContactInfo(fields: Partial<ContactInformation>): ContactInformation {
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
}

/**
 * Common test scenarios as factory functions
 */
const TestScenarios = {
  /**
   * Contact history with only email (no phone or address)
   */
  emailOnly: () =>
    createMockPublicContactHistory({
      before: createPartialContactInfo({
        email: 'email@example.com',
      }),
      after: createPartialContactInfo({
        phone: { number: '555-123-4567' },
      }),
    }),

  /**
   * Contact history with undefined address
   */
  undefinedAddress: () =>
    createMockPublicContactHistory({
      before: {
        email: 'test@example.com',
        phone: { number: '555-123-4567' },
      } as ContactInformation,
      after: createPartialContactInfo({}),
    }),

  /**
   * Contact history with phone but no extension
   */
  phoneNoExtension: () =>
    createMockPublicContactHistory({
      before: createPartialContactInfo({
        phone: { number: '555-123-4567' },
      }),
      after: createPartialContactInfo({
        phone: { number: '555-987-6543' },
      }),
    }),

  /**
   * Completely empty contact information
   */
  emptyContact: () =>
    createMockPublicContactHistory({
      before: undefined,
      after: undefined,
    }),

  /**
   * Name history with undefined values
   */
  emptyName: () =>
    createMockNameHistory({
      before: undefined,
      after: undefined,
    }),

  /**
   * Name history with empty strings
   */
  emptyStringName: () =>
    createMockNameHistory({
      before: '',
      after: '',
    }),

  /**
   * Contact with only address1 and zipCode
   */
  addressPartial: () =>
    createMockPublicContactHistory({
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
    }),

  /**
   * Contact with all address fields (address1, address2, address3)
   */
  addressComplete: () =>
    createMockPublicContactHistory({
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
    }),

  /**
   * Contact with only city and state
   */
  cityAndState: () =>
    createMockPublicContactHistory({
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
    }),

  /**
   * Contact with only state
   */
  stateOnly: () =>
    createMockPublicContactHistory({
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
    }),

  /**
   * Contact with only city
   */
  cityOnly: () =>
    createMockPublicContactHistory({
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
    }),

  /**
   * Contact with undefined phone
   */
  undefinedPhone: () =>
    createMockPublicContactHistory({
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
    }),

  /**
   * Contact with phone number but undefined extension
   */
  phoneNoExtensionUndefined: () =>
    createMockPublicContactHistory({
      before: createPartialContactInfo({
        phone: { number: '555-999-8888', extension: undefined },
      }),
      after: createPartialContactInfo({}),
    }),
};

/**
 * Reset the mock ID counter (useful for test isolation)
 */
function resetMockIdCounter(): void {
  mockIdCounter = 1;
}
