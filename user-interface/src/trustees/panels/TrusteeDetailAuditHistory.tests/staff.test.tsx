import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import TrusteeDetailAuditHistory from '../TrusteeDetailAuditHistory';
import Api2 from '@/lib/models/api2';
import { TrusteeStaffHistory } from '@common/cams/trustees';
import MockData from '@common/cams/test-utilities/mock-data';

const MOCK_TRUSTEE_ID = 'trustee-123';

function createMockStaffHistory(override: Partial<TrusteeStaffHistory> = {}): TrusteeStaffHistory {
  const userRef = MockData.getCamsUserReference({ name: 'John Doe' });
  return {
    id: 'history-1',
    trusteeId: MOCK_TRUSTEE_ID,
    documentType: 'AUDIT_ASSISTANT',
    staffId: 'staff-after',
    before: MockData.getTrusteeStaff({
      id: 'staff-before',
      trusteeId: MOCK_TRUSTEE_ID,
      name: 'Jane Smith',
      contact: MockData.getContactInformation(),
    }),
    after: MockData.getTrusteeStaff({
      id: 'staff-after',
      trusteeId: MOCK_TRUSTEE_ID,
      name: 'Jane M. Smith',
      title: 'Senior Staff',
      contact: MockData.getContactInformation(),
    }),
    updatedOn: '2024-01-15T10:00:00Z',
    updatedBy: userRef,
    createdOn: '2024-01-15T10:00:00Z',
    createdBy: userRef,
    ...override,
  };
}

describe('TrusteeDetailAuditHistory - Staff Member History', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should render staff member change history with name', async () => {
    const mockHistory = [createMockStaffHistory()];
    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: mockHistory });

    render(<TrusteeDetailAuditHistory trusteeId={MOCK_TRUSTEE_ID} />);

    await screen.findByTestId('change-type-staff-0');

    expect(screen.getByTestId('change-type-staff-0')).toHaveTextContent('Trustee Staff');
    expect(screen.getByTestId('previous-staff-0')).toHaveTextContent('Jane Smith');
    expect(screen.getByTestId('new-staff-0')).toHaveTextContent('Jane M. Smith');
    expect(screen.getByTestId('new-staff-0')).toHaveTextContent('Senior Staff');
  });

  test('should render when staff member is newly added (before is undefined)', async () => {
    const mockHistory = [
      createMockStaffHistory({
        before: undefined,
        after: MockData.getTrusteeStaff({
          id: 'staff-after',
          trusteeId: MOCK_TRUSTEE_ID,
          name: 'Jane Smith',
          title: 'Legal Staff',
          contact: MockData.getContactInformation(),
        }),
      }),
    ];
    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: mockHistory });

    render(<TrusteeDetailAuditHistory trusteeId={MOCK_TRUSTEE_ID} />);

    await screen.findByTestId('change-type-staff-0');

    expect(screen.getByTestId('previous-staff-0')).toBeEmptyDOMElement();
    expect(screen.getByTestId('new-staff-0')).toHaveTextContent('Jane Smith');
    expect(screen.getByTestId('new-staff-0')).toHaveTextContent('Legal Staff');
  });

  test('should render when staff member is removed (after is undefined)', async () => {
    const mockHistory = [
      createMockStaffHistory({
        before: MockData.getTrusteeStaff({
          id: 'staff-before',
          trusteeId: MOCK_TRUSTEE_ID,
          name: 'Jane Smith',
          title: 'Legal Staff',
          contact: MockData.getContactInformation(),
        }),
        after: undefined,
      }),
    ];
    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: mockHistory });

    render(<TrusteeDetailAuditHistory trusteeId={MOCK_TRUSTEE_ID} />);

    await screen.findByTestId('change-type-staff-0');

    expect(screen.getByTestId('previous-staff-name-0')).toHaveTextContent('Jane Smith');
    expect(screen.getByTestId('previous-staff-title-0')).toHaveTextContent('Legal Staff');
    expect(screen.getByTestId('new-staff-0')).toBeEmptyDOMElement();
  });

  test('should render staff member without title', async () => {
    const mockHistory = [
      createMockStaffHistory({
        before: MockData.getTrusteeStaff({
          id: 'staff-before',
          trusteeId: MOCK_TRUSTEE_ID,
          name: 'Jane Smith',
          title: undefined,
          contact: MockData.getContactInformation(),
        }),
        after: MockData.getTrusteeStaff({
          id: 'staff-after',
          trusteeId: MOCK_TRUSTEE_ID,
          name: 'Jane M. Smith',
          title: undefined,
          contact: MockData.getContactInformation(),
        }),
      }),
    ];
    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: mockHistory });

    render(<TrusteeDetailAuditHistory trusteeId={MOCK_TRUSTEE_ID} />);

    await screen.findByTestId('change-type-staff-0');

    expect(screen.getByTestId('previous-staff-name-0')).toHaveTextContent('Jane Smith');
    expect(screen.queryByTestId('previous-staff-title-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('new-staff-name-0')).toHaveTextContent('Jane M. Smith');
    expect(screen.queryByTestId('new-staff-title-0')).not.toBeInTheDocument();
  });

  test('should render staff member contact information', async () => {
    const mockContact = MockData.getContactInformation({
      email: 'jane.smith@example.com',
      phone: { number: '555-555-5555', extension: '123' },
      address: {
        address1: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        countryCode: 'US',
      },
    });

    const mockHistory = [
      createMockStaffHistory({
        after: MockData.getTrusteeStaff({
          id: 'staff-after',
          trusteeId: MOCK_TRUSTEE_ID,
          name: 'Jane Smith',
          title: 'Legal Staff',
          contact: mockContact,
        }),
      }),
    ];
    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: mockHistory });

    render(<TrusteeDetailAuditHistory trusteeId={MOCK_TRUSTEE_ID} />);

    await screen.findByTestId('change-type-staff-0');

    const newStaff = screen.getByTestId('new-staff-0');
    expect(newStaff).toHaveTextContent('123 Main St');
    expect(newStaff).toHaveTextContent('New York');
    expect(newStaff).toHaveTextContent('555-555-5555, ext. 123');
    expect(newStaff).toHaveTextContent('jane.smith@example.com');
  });

  test('should render staff member history mixed with other history types', async () => {
    const mockHistory = [
      createMockStaffHistory(),
      {
        id: 'history-2',
        trusteeId: MOCK_TRUSTEE_ID,
        documentType: 'AUDIT_NAME' as const,
        before: 'John Doe',
        after: 'John M. Doe',
        updatedOn: '2024-01-14T10:00:00Z',
        updatedBy: MockData.getCamsUserReference({ name: 'Admin User' }),
        createdOn: '2024-01-14T10:00:00Z',
        createdBy: MockData.getCamsUserReference({ name: 'Admin User' }),
      },
    ];
    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: mockHistory });

    render(<TrusteeDetailAuditHistory trusteeId={MOCK_TRUSTEE_ID} />);

    await screen.findByTestId('change-type-staff-0');

    expect(screen.getByTestId('change-type-staff-0')).toHaveTextContent('Trustee Staff');
    expect(screen.getByTestId('change-type-name-1')).toHaveTextContent('Name');
  });
});
