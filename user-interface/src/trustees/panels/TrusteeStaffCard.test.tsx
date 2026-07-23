import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import TrusteeStaffCard from './TrusteeStaffCard';
import { TrusteeStaff } from '@common/cams/trustee-staff';
import * as featureFlagsHook from '@/lib/hooks/UseFeatureFlags';
import { TRUSTEE_TYPED_PHONES } from '@/lib/hooks/UseFeatureFlags';

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
      { number: '555-333-4444', type: 'personalMobile' },
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
    vi.restoreAllMocks();
    mockOnEdit.mockClear();
    mockOnAdd.mockClear();
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({ [TRUSTEE_TYPED_PHONES]: false });
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

  test('should render the title independently of contact being present', () => {
    const titleOnlyStaff: TrusteeStaff = {
      ...baseStaffMember,
      contact: undefined,
    };

    render(
      <TrusteeStaffCard
        staffMember={titleOnlyStaff}
        index={0}
        onEdit={mockOnEdit}
        onAdd={mockOnAdd}
      />,
    );

    expect(screen.getByTestId('staff-title-0')).toHaveTextContent('Assistant');
    expect(screen.queryByText('123 Main St')).not.toBeInTheDocument();
  });

  test('should render contact independently of title being present', () => {
    const contactOnlyStaff: TrusteeStaff = {
      ...baseStaffMember,
      title: undefined,
    };

    render(
      <TrusteeStaffCard
        staffMember={contactOnlyStaff}
        index={0}
        onEdit={mockOnEdit}
        onAdd={mockOnAdd}
      />,
    );

    expect(screen.queryByTestId('staff-title-0')).not.toBeInTheDocument();
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
  });

  test('should render title and pass address/email through to FormattedContact', () => {
    render(
      <TrusteeStaffCard
        staffMember={baseStaffMember}
        index={0}
        onEdit={mockOnEdit}
        onAdd={mockOnAdd}
      />,
    );

    expect(screen.getByTestId('staff-title-0')).toHaveTextContent('Assistant');
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
    expect(screen.getByText(/jane@example\.com/)).toBeInTheDocument();
  });

  test('should show only the direct phone when the flag is disabled', () => {
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({ [TRUSTEE_TYPED_PHONES]: false });

    render(
      <TrusteeStaffCard
        staffMember={baseStaffMember}
        index={0}
        onEdit={mockOnEdit}
        onAdd={mockOnAdd}
      />,
    );

    expect(screen.getByText('555-111-2222')).toBeInTheDocument();
    expect(screen.queryByText('555-333-4444')).not.toBeInTheDocument();
  });

  test('should show every typed phone when the flag is enabled', () => {
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({ [TRUSTEE_TYPED_PHONES]: true });

    render(
      <TrusteeStaffCard
        staffMember={baseStaffMember}
        index={0}
        onEdit={mockOnEdit}
        onAdd={mockOnAdd}
      />,
    );

    expect(screen.getByText('555-111-2222')).toBeInTheDocument();
    expect(screen.getByText('555-333-4444')).toBeInTheDocument();
  });

  test('should show no phone when the flag is disabled and there is no direct-type phone', () => {
    const personalMobileOnlyStaff: TrusteeStaff = {
      ...baseStaffMember,
      contact: {
        ...baseStaffMember.contact,
        phones: [{ number: '555-333-4444', type: 'personalMobile' }],
      },
    };
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({ [TRUSTEE_TYPED_PHONES]: false });

    render(
      <TrusteeStaffCard
        staffMember={personalMobileOnlyStaff}
        index={0}
        onEdit={mockOnEdit}
        onAdd={mockOnAdd}
      />,
    );

    expect(screen.queryByText('555-333-4444')).not.toBeInTheDocument();
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
