import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import TrusteeStaffCard from './TrusteeStaffCard';
import { TrusteeStaff } from '@common/cams/trustee-staff';

vi.mock('@/lib/hooks/UseFeatureFlags', () => ({
  default: vi.fn(),
  TRUSTEE_TYPED_PHONES: 'trustee-typed-phones',
}));

import useFeatureFlags, { TRUSTEE_TYPED_PHONES } from '@/lib/hooks/UseFeatureFlags';

const mockUseFeatureFlags = vi.mocked(useFeatureFlags);

const baseStaffMember: TrusteeStaff = {
  id: 'staff-1',
  trusteeId: 'trustee-1',
  name: 'Jane Staff',
  title: 'Assistant',
  contact: {
    address: {
      address1: '123 Main St',
      city: 'Anytown',
      state: 'NY',
      zipCode: '10001',
      countryCode: 'US',
    },
    phones: [
      { number: '555-111-2222', type: 'direct' },
      { number: '555-333-4444', type: 'cell' },
    ],
    email: 'jane@example.com',
  },
  updatedBy: { id: 'user-1', name: 'Test User' },
  updatedOn: '2024-01-01T00:00:00Z',
};

describe('TrusteeStaffCard', () => {
  const mockOnEdit = vi.fn();
  const mockOnAdd = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFeatureFlags.mockReturnValue({ [TRUSTEE_TYPED_PHONES]: false });
  });

  test('should show "no information added" when staffMember is undefined', () => {
    render(
      <TrusteeStaffCard staffMember={undefined} index={0} onEdit={mockOnEdit} onAdd={mockOnAdd} />,
    );

    expect(screen.getByTestId('no-staff-information')).toHaveTextContent('No information added.');
    expect(screen.getByText('Trustee Staff')).toBeInTheDocument();
  });

  test('should call onAdd when the add button is clicked for an empty card', async () => {
    render(
      <TrusteeStaffCard staffMember={undefined} index={0} onEdit={mockOnEdit} onAdd={mockOnAdd} />,
    );

    screen.getByRole('button', { name: 'Add trustee staff member' }).click();
    expect(mockOnAdd).toHaveBeenCalledTimes(1);
    expect(mockOnEdit).not.toHaveBeenCalled();
  });

  test('should call onEdit when the edit button is clicked for a populated card', async () => {
    render(
      <TrusteeStaffCard
        staffMember={baseStaffMember}
        index={0}
        onEdit={mockOnEdit}
        onAdd={mockOnAdd}
      />,
    );

    screen.getByRole('button', { name: /edit trustee staff member jane staff/i }).click();
    expect(mockOnEdit).toHaveBeenCalledTimes(1);
    expect(mockOnAdd).not.toHaveBeenCalled();
  });

  test('should show "no additional information" when staff member has only a name', () => {
    const nameOnlyStaff: TrusteeStaff = {
      ...baseStaffMember,
      title: undefined,
      contact: undefined,
    };

    render(
      <TrusteeStaffCard
        staffMember={nameOnlyStaff}
        index={2}
        onEdit={mockOnEdit}
        onAdd={mockOnAdd}
      />,
    );

    expect(screen.getByTestId('staff-name-only-2')).toHaveTextContent(
      'No additional information added.',
    );
  });

  test('should render title and address/email via FormattedContact', () => {
    render(
      <TrusteeStaffCard
        staffMember={baseStaffMember}
        index={0}
        onEdit={mockOnEdit}
        onAdd={mockOnAdd}
      />,
    );

    expect(screen.getByTestId('staff-title-0')).toHaveTextContent('Assistant');
    expect(screen.getByTestId('staff-0-street-address')).toHaveTextContent('123 Main St');
    expect(screen.getByTestId('staff-0-email')).toBeInTheDocument();
  });

  test('should show only the direct phone (no type label) when the flag is disabled', () => {
    mockUseFeatureFlags.mockReturnValue({ [TRUSTEE_TYPED_PHONES]: false });

    render(
      <TrusteeStaffCard
        staffMember={baseStaffMember}
        index={0}
        onEdit={mockOnEdit}
        onAdd={mockOnAdd}
      />,
    );

    expect(screen.getByTestId('staff-0-phone-number')).toHaveTextContent('555-111-2222');
    expect(screen.queryByTestId('staff-0-phones')).not.toBeInTheDocument();
    expect(screen.queryByText('555-333-4444')).not.toBeInTheDocument();
  });

  test('should show every typed phone with a type label when the flag is enabled', () => {
    mockUseFeatureFlags.mockReturnValue({ [TRUSTEE_TYPED_PHONES]: true });

    render(
      <TrusteeStaffCard
        staffMember={baseStaffMember}
        index={0}
        onEdit={mockOnEdit}
        onAdd={mockOnAdd}
      />,
    );

    expect(screen.getByTestId('staff-0-phones')).toBeInTheDocument();
    expect(screen.getByTestId('staff-0-phone-direct')).toHaveTextContent('555-111-2222');
    expect(screen.getByTestId('staff-0-phone-direct')).toHaveTextContent('(Direct)');
    expect(screen.getByTestId('staff-0-phone-cell')).toHaveTextContent('555-333-4444');
    expect(screen.getByTestId('staff-0-phone-cell')).toHaveTextContent('(Cell)');
  });

  test('should not render a phone section when staff member has no phones', () => {
    const staffWithoutPhones: TrusteeStaff = {
      ...baseStaffMember,
      contact: { ...baseStaffMember.contact, phones: undefined },
    };

    render(
      <TrusteeStaffCard
        staffMember={staffWithoutPhones}
        index={0}
        onEdit={mockOnEdit}
        onAdd={mockOnAdd}
      />,
    );

    expect(screen.queryByTestId('staff-0-phone-number')).not.toBeInTheDocument();
    expect(screen.queryByTestId('staff-0-phones')).not.toBeInTheDocument();
  });
});
