import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import BondKeyDatesCard from './BondKeyDatesCard';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { CamsRole } from '@common/cams/roles';
import TestingUtilities from '@/lib/testing/testing-utilities';

const mockUseNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: mockUseNavigate,
  };
});

describe('BondKeyDatesCard', () => {
  let mockNavigate: ReturnType<typeof vi.fn>;

  const keyDates: TrusteeUpcomingKeyDates = {
    id: 'key-dates-001',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-123',
    appointmentId: 'appointment-001',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    bondIssuedDate: '2023-06-01',
    bondRenewalDate: '2026-06-01',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate = vi.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
  });

  function renderCard(data: TrusteeUpcomingKeyDates | null = keyDates, isLoading = false) {
    return render(
      <BrowserRouter>
        <BondKeyDatesCard
          trusteeId="trustee-123"
          appointmentId="appointment-001"
          data={data}
          isLoading={isLoading}
        />
      </BrowserRouter>,
    );
  }

  test('renders the Bond Issued and Bond Renewal dates', () => {
    renderCard();

    expect(screen.getByText('Bond')).toBeInTheDocument();
    expect(screen.getByTestId('bond-renewal-date')).toHaveTextContent('06/01/2026');
    expect(screen.getByTestId('bond-issued-date')).toHaveTextContent('06/01/2023');
  });

  test('shows "No date added" when dates are missing', () => {
    renderCard({ ...keyDates, bondIssuedDate: undefined, bondRenewalDate: undefined });

    expect(screen.getAllByText('No date added')).toHaveLength(2);
  });

  test('shows "No date added" for both fields when there is no key dates document', () => {
    renderCard(null);

    expect(screen.getAllByText('No date added')).toHaveLength(2);
  });

  test('shows a loading spinner while loading', () => {
    renderCard(null, true);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Bond')).not.toBeInTheDocument();
  });

  test('renders an Edit button when user has TrusteeAdmin role', () => {
    renderCard();

    expect(screen.getByTestId('button-edit-bond-key-dates-appointment-001')).toBeInTheDocument();
  });

  test('does not render an Edit button when user lacks TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    renderCard();

    expect(
      screen.queryByTestId('button-edit-bond-key-dates-appointment-001'),
    ).not.toBeInTheDocument();
  });

  test('navigates to the bond key dates edit form when Edit is clicked', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByTestId('button-edit-bond-key-dates-appointment-001'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/trustees/trustee-123/appointments/appointment-001/bond-key-dates/edit',
    );
  });
});
