import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import TrusteeDetailAuditHistory from '../TrusteeDetailAuditHistory';
import Api2 from '@/lib/models/api2';
import {
  TrusteeHistory,
  TrusteeNameHistory,
  TrusteePublicContactHistory,
} from '@common/cams/trustees';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import {
  MOCK_TRUSTEE_ID,
  renderWithProps,
  renderHistoryAndWaitForTable,
  createMockNameHistory,
  createMockPublicContactHistory,
  createMockInternalContactHistory,
  TestScenarios,
} from './trusteeHistoryTestHelpers';

describe('TrusteeDetailAuditHistory - Core Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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
    vi.spyOn(Api2, 'getTrusteeHistory').mockReturnValue(new Promise(() => {}));

    renderWithProps({});

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  test('should show empty message when no history is available', async () => {
    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [] });

    renderWithProps({});

    const emptyState = await screen.findByTestId('empty-trustee-history-test-id');

    expect(emptyState).toHaveTextContent('No changes have been made to this trustee.');
    expect(screen.queryByTestId('trustee-history-table')).not.toBeInTheDocument();
  });

  test('should display name change history correctly', async () => {
    await renderHistoryAndWaitForTable([mockNameHistory]);

    expect(screen.getByTestId('change-history-heading')).toHaveTextContent('Change History');
    expect(screen.getByRole('table')).toHaveClass('usa-table', 'usa-table--borderless');

    expect(screen.getByRole('columnheader', { name: 'Change' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'New' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Changed by' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument();

    expect(screen.getByTestId('change-type-name-0')).toHaveTextContent('Name');
    expect(screen.getByTestId('previous-name-0')).toHaveTextContent('John Smith');
    expect(screen.getByTestId('new-name-0')).toHaveTextContent('John Doe');
    expect(screen.getByTestId('changed-by-0')).toHaveTextContent('SYSTEM');
    expect(screen.getByTestId('change-date-0')).toHaveTextContent('01/15/2024');
  });

  test('should display public contact change history correctly', async () => {
    await renderHistoryAndWaitForTable([mockPublicContactHistory]);

    expect(screen.getByTestId('change-type-public-contact-0')).toHaveTextContent('Public Contact');

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
    expect(screen.getByTestId('change-date-0')).toHaveTextContent('01/16/2024');
  });

  test('should display internal contact change history correctly', async () => {
    await renderHistoryAndWaitForTable([mockInternalContactHistory]);

    expect(screen.getByTestId('change-type-internal-contact-0')).toHaveTextContent(
      'Internal Contact',
    );
    expect(screen.getByTestId('previous-contact-0')).toHaveTextContent('(none)');
    expect(screen.getByTestId('new-contact-0')).toHaveTextContent(
      '789 Internal StInternal City, TX 78901555-111-2222internal@example.com',
    );
    expect(screen.getByTestId('changed-by-0')).toHaveTextContent('Jane Admin');
    expect(screen.getByTestId('change-date-0')).toHaveTextContent('01/17/2024');
  });

  test('should display multiple history entries sorted by date', async () => {
    const historyData = [mockNameHistory, mockPublicContactHistory, mockInternalContactHistory];
    await renderHistoryAndWaitForTable(historyData);

    expect(screen.getByTestId('change-type-name-2')).toHaveTextContent('Name');
    expect(screen.getByTestId('change-type-public-contact-1')).toHaveTextContent('Public Contact');
    expect(screen.getByTestId('change-type-internal-contact-0')).toHaveTextContent(
      'Internal Contact',
    );

    expect(screen.getByTestId('previous-name-2')).toHaveTextContent('John Smith');

    const previousContact1 = screen.getByTestId('previous-contact-1');
    expect(previousContact1.querySelector('.address')).toHaveTextContent('123 Old St');
    expect(previousContact1.querySelector('.city-state-zip')).toHaveTextContent(
      'Old City, NY 12345',
    );
    expect(previousContact1.querySelector('.phone')).toHaveTextContent('555-123-4567, ext. 123');
    expect(previousContact1.querySelector('.email')).toHaveTextContent('old@example.com');
    expect(screen.getByTestId('previous-contact-0')).toHaveTextContent('(none)');
  });

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
      vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({
        data: [contactHistory as TrusteeHistory],
      });

      renderWithProps({});

      await screen.findByTestId('trustee-history-table');

      const previousContact = screen.getByTestId('previous-contact-0');
      const newContact = screen.getByTestId('new-contact-0');

      if (expectations.previousContact?.expectedText) {
        expect(previousContact).toHaveTextContent(expectations.previousContact.expectedText);
      }

      if (expectations.newContact?.expectedText) {
        expect(newContact).toHaveTextContent(expectations.newContact.expectedText);
      }

      if (expectations.previousContact?.expectedElements) {
        Object.entries(expectations.previousContact.expectedElements).forEach(
          ([selector, text]) => {
            const element = previousContact.querySelector(`.${selector}`);
            expect(element).toHaveTextContent(text);
          },
        );
      }

      if (expectations.previousContact?.notExpectedElements) {
        expectations.previousContact.notExpectedElements.forEach((selector: string) => {
          expect(previousContact.querySelector(`.${selector}`)).not.toBeInTheDocument();
        });
      }

      if (expectations.newContact?.expectedElements) {
        Object.entries(expectations.newContact.expectedElements).forEach(([selector, text]) => {
          const element = newContact.querySelector(`.${selector}`);
          expect(element).toHaveTextContent(text);
        });
      }

      if (expectations.newContact?.notExpectedElements) {
        expectations.newContact.notExpectedElements.forEach((selector: string) => {
          expect(newContact.querySelector(`.${selector}`)).not.toBeInTheDocument();
        });
      }
    },
  );

  test('should handle missing name fields in name history', async () => {
    const nameHistory = TestScenarios.emptyName();
    await renderHistoryAndWaitForTable([nameHistory]);

    expect(screen.getByTestId('previous-name-0')).toHaveTextContent('(none)');
    expect(screen.getByTestId('new-name-0')).toHaveTextContent('(none)');
  });

  test('should handle API error gracefully', async () => {
    vi.spyOn(Api2, 'getTrusteeHistory').mockRejectedValue(new Error('API Error'));

    renderWithProps({});

    const emptyState = await screen.findByTestId('empty-trustee-history-test-id');

    expect(emptyState).toHaveTextContent('No changes have been made to this trustee.');
    expect(screen.queryByTestId('trustee-history-table')).not.toBeInTheDocument();
  });

  test('should call API with correct trustee ID', async () => {
    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [] });

    renderWithProps({});

    await screen.findByTestId('empty-trustee-history-test-id');

    expect(Api2.getTrusteeHistory).toHaveBeenCalledWith(MOCK_TRUSTEE_ID);
  });

  test('should handle missing updatedBy field', async () => {
    const historyWithoutUpdatedBy: TrusteeNameHistory = {
      id: 'audit-8-id',
      trusteeId: 'audit-8',
      documentType: 'AUDIT_NAME',
      before: 'Old Name',
      after: 'New Name',
      updatedOn: '2024-01-18T16:00:00Z',
      updatedBy: { id: '', name: '' },
    };

    await renderHistoryAndWaitForTable([historyWithoutUpdatedBy]);

    expect(screen.getByTestId('changed-by-0')).toHaveTextContent('');
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

    await renderHistoryAndWaitForTable([contactHistoryUndefinedContact]);

    expect(screen.getByTestId('previous-contact-0')).toHaveTextContent('(none)');
    expect(screen.getByTestId('new-contact-0')).toHaveTextContent('(none)');
  });

  test('should handle empty string in name history', async () => {
    const nameHistory = TestScenarios.emptyStringName();
    await renderHistoryAndWaitForTable([nameHistory]);

    expect(screen.getByTestId('previous-name-0')).toHaveTextContent('(none)');
    expect(screen.getByTestId('new-name-0')).toHaveTextContent('(none)');
  });

  test('should handle API response with null data', async () => {
    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue(
      null as unknown as { data: TrusteeHistory[] },
    );

    renderWithProps({});

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();

    await screen.findByTestId('empty-trustee-history-test-id');

    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  test('should handle component unmounting during API call', async () => {
    let resolvePromise: ((value: { data: TrusteeHistory[] }) => void) | undefined;
    const promise = new Promise<{ data: TrusteeHistory[] }>((resolve) => {
      resolvePromise = resolve;
    });

    vi.spyOn(Api2, 'getTrusteeHistory').mockReturnValue(promise);

    const { unmount } = render(<TrusteeDetailAuditHistory trusteeId={MOCK_TRUSTEE_ID} />);

    unmount();

    resolvePromise?.({ data: [mockNameHistory] });
  });
});
