import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import TrusteeDetailProfile, { TrusteeDetailProfileProps } from './TrusteeDetailProfile';
import { Trustee } from '@common/cams/trustees';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import MockData from '@common/cams/test-utilities/mock-data';

vi.mock('./TrusteeOverviewCard', () => ({
  default: vi.fn(() => <div data-testid="mock-trustee-overview-card" />),
}));
vi.mock('./ContactInformationCard', () => ({
  default: vi.fn(() => <div data-testid="mock-contact-information-card" />),
}));
vi.mock('./TrusteeStaffCard', () => ({
  default: vi.fn(({ index }) => <div data-testid={`mock-trustee-staff-card-${index}`} />),
}));
vi.mock('./MeetingOfCreditorsInfoCard', () => ({
  default: vi.fn(() => <div data-testid="mock-meeting-of-creditors-info-card" />),
}));
vi.mock('./OtherInformationCard', () => ({
  default: vi.fn(() => <div data-testid="mock-other-information-card" />),
}));

import TrusteeOverviewCard from './TrusteeOverviewCard';
import ContactInformationCard from './ContactInformationCard';
import TrusteeStaffCard from './TrusteeStaffCard';
import MeetingOfCreditorsInfoCard from './MeetingOfCreditorsInfoCard';
import OtherInformationCard from './OtherInformationCard';

const mockTrusteeOverviewCard = vi.mocked(TrusteeOverviewCard);
const mockContactInformationCard = vi.mocked(ContactInformationCard);
const mockTrusteeStaffCard = vi.mocked(TrusteeStaffCard);
const mockMeetingOfCreditorsInfoCard = vi.mocked(MeetingOfCreditorsInfoCard);
const mockOtherInformationCard = vi.mocked(OtherInformationCard);

const mockTrustee: Trustee = {
  id: '--id-guid--',
  trusteeId: '123',
  firstName: 'John',
  lastName: 'Doe',
  name: 'John Doe',
  public: {
    address: {
      address1: '123 Main St',
      city: 'Anytown',
      state: 'NY',
      zipCode: '12345',
      countryCode: 'US',
    },
    phone: { number: '555-123-4567' },
    email: 'john.doe.public@example.com',
  },
  internal: {
    address: {
      address1: '456 Internal St',
      city: 'Internal City',
      state: 'CA',
      zipCode: '54321',
      countryCode: 'US',
    },
    phones: [{ number: '555-987-6543', type: 'direct' as const }],
    email: 'john.doe.internal@example.com',
  },
  updatedBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2024-01-01T00:00:00Z',
};

const mockOnEditPublicProfile = vi.fn();
const mockOnEditInternalProfile = vi.fn();
const mockOnEditOtherInformation = vi.fn();
const onEditZoomInfo = vi.fn();
const mockOnAddStaff = vi.fn();
const mockOnEditStaff = vi.fn();

function renderWithProps(props?: Partial<TrusteeDetailProfileProps>) {
  const defaultProps: TrusteeDetailProfileProps = {
    trustee: mockTrustee,
    onEditPublicProfile: mockOnEditPublicProfile,
    onEditInternalProfile: mockOnEditInternalProfile,
    onEditOtherInformation: mockOnEditOtherInformation,
    onEditZoomInfo: onEditZoomInfo,
    onAddStaff: mockOnAddStaff,
    onEditStaff: mockOnEditStaff,
    softwareProfiles: [],
  };

  const renderProps = { ...defaultProps, ...props };
  render(<TrusteeDetailProfile {...renderProps} />);
}

describe('TrusteeDetailProfile', () => {
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    vi.clearAllMocks();
    userEvent = TestingUtilities.setupUserEvent();
  });

  test('passes trustee and onEditPublicProfile to TrusteeOverviewCard', () => {
    renderWithProps({});

    expect(screen.getByText('Contact Information')).toBeInTheDocument();
    expect(mockTrusteeOverviewCard).toHaveBeenCalledWith(
      expect.objectContaining({ trustee: mockTrustee, onEdit: mockOnEditPublicProfile }),
      undefined,
    );
  });

  test('passes internal contact and onEditInternalProfile to ContactInformationCard', () => {
    renderWithProps({});

    expect(mockContactInformationCard).toHaveBeenCalledWith(
      expect.objectContaining({
        internalContact: mockTrustee.internal,
        onEdit: mockOnEditInternalProfile,
      }),
      undefined,
    );
  });

  test('renders a single empty TrusteeStaffCard when there is no staff', () => {
    renderWithProps({ trustee: { ...mockTrustee, staff: undefined } });

    expect(screen.getByTestId('mock-trustee-staff-card-0')).toBeInTheDocument();
    expect(mockTrusteeStaffCard).toHaveBeenCalledTimes(1);
    expect(mockTrusteeStaffCard.mock.calls[0][0].staffMember).toBeUndefined();
    expect(mockTrusteeStaffCard).toHaveBeenCalledWith(
      expect.objectContaining({ index: 0, onAdd: mockOnAddStaff }),
      undefined,
    );
  });

  test('invokes onAddStaff when the empty-state TrusteeStaffCard fires onEdit', () => {
    renderWithProps({ trustee: { ...mockTrustee, staff: undefined } });

    const { onEdit } = mockTrusteeStaffCard.mock.calls[0][0];
    onEdit?.();

    expect(mockOnAddStaff).toHaveBeenCalledTimes(1);
  });

  test('renders one TrusteeStaffCard per staff member', () => {
    const staffMember1 = MockData.getTrusteeStaff({ trusteeId: mockTrustee.id, name: 'Jane' });
    const staffMember2 = MockData.getTrusteeStaff({ trusteeId: mockTrustee.id, name: 'Bob' });

    renderWithProps({ trustee: { ...mockTrustee, staff: [staffMember1, staffMember2] } });

    expect(mockTrusteeStaffCard).toHaveBeenCalledTimes(2);
    expect(mockTrusteeStaffCard).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ staffMember: staffMember1, index: 0, onAdd: mockOnAddStaff }),
      undefined,
    );
    expect(mockTrusteeStaffCard).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ staffMember: staffMember2, index: 1, onAdd: mockOnAddStaff }),
      undefined,
    );
  });

  test('invokes onEditStaff with the staff member id when a populated TrusteeStaffCard fires onEdit', () => {
    const staffMember = MockData.getTrusteeStaff({ trusteeId: mockTrustee.id });

    renderWithProps({ trustee: { ...mockTrustee, staff: [staffMember] } });

    const { onEdit } = mockTrusteeStaffCard.mock.calls[0][0];
    onEdit?.();

    expect(mockOnEditStaff).toHaveBeenCalledWith(staffMember.id);
  });

  test('shows "Add Trustee Staff" header button only when staff members exist', async () => {
    renderWithProps({ trustee: { ...mockTrustee, staff: undefined } });
    expect(screen.queryByRole('button', { name: 'Add trustee staff' })).not.toBeInTheDocument();

    const staffMember = MockData.getTrusteeStaff({ trusteeId: mockTrustee.id });
    renderWithProps({ trustee: { ...mockTrustee, staff: [staffMember] } });
    const addButton = screen.getByRole('button', { name: 'Add trustee staff' });
    await userEvent.click(addButton);

    expect(mockOnAddStaff).toHaveBeenCalledTimes(1);
  });

  test('passes zoomInfo and onEditZoomInfo to MeetingOfCreditorsInfoCard', () => {
    renderWithProps({});

    expect(mockMeetingOfCreditorsInfoCard).toHaveBeenCalledWith(
      expect.objectContaining({ zoomInfo: mockTrustee.zoomInfo, onEdit: onEditZoomInfo }),
      undefined,
    );
  });

  describe('showSoftwareBankInfo prop', () => {
    test('renders OtherInformationCard with banks/software props when showSoftwareBankInfo is true', () => {
      const softwareProfiles = [
        {
          id: 'sw-bestcase',
          documentType: 'BANKRUPTCY_SOFTWARE' as const,
          name: 'BestCase Trustee Software v2.1',
          status: 'active' as const,
          updatedOn: '2024-01-01T00:00:00.000Z',
          updatedBy: SYSTEM_USER_REFERENCE,
        },
      ];

      renderWithProps({
        showSoftwareBankInfo: true,
        trustee: { ...mockTrustee, banks: ['First National Bank'], softwareId: 'sw-bestcase' },
        softwareProfiles,
      });

      expect(screen.getByText('341 Meeting and Other Information')).toBeInTheDocument();
      expect(mockOtherInformationCard).toHaveBeenCalledWith(
        expect.objectContaining({
          banks: ['First National Bank'],
          softwareId: 'sw-bestcase',
          softwareProfiles,
          onEdit: mockOnEditOtherInformation,
        }),
        undefined,
      );
    });

    test('hides OtherInformationCard and adjusts heading when showSoftwareBankInfo is false', () => {
      renderWithProps({ showSoftwareBankInfo: false });

      expect(screen.queryByTestId('mock-other-information-card')).not.toBeInTheDocument();
      expect(screen.getByText('341 Meeting Information')).toBeInTheDocument();
      expect(screen.queryByText('341 Meeting and Other Information')).not.toBeInTheDocument();
    });

    test('still renders MeetingOfCreditorsInfoCard when showSoftwareBankInfo is false', () => {
      renderWithProps({ showSoftwareBankInfo: false });

      expect(screen.getByTestId('mock-meeting-of-creditors-info-card')).toBeInTheDocument();
    });
  });
});
