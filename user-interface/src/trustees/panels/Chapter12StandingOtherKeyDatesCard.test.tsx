import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Chapter12StandingOtherKeyDatesCard from './Chapter12StandingOtherKeyDatesCard';
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

describe('Chapter12StandingOtherKeyDatesCard', () => {
  let mockNavigate: ReturnType<typeof vi.fn>;

  const keyDates: TrusteeUpcomingKeyDates = {
    id: 'key-dates-003',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-123',
    appointmentId: 'appointment-001',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    leaseExpiration: '2023-06-03',
    pastBackgroundQuestion: '2023-06-03',
    idExpiration: '2023-06-03',
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
        <Chapter12StandingOtherKeyDatesCard
          trusteeId="trustee-123"
          appointmentId="appointment-001"
          data={data}
          isLoading={isLoading}
        />
      </BrowserRouter>,
    );
  }

  test('renders the Other title and all four columns', () => {
    renderCard();

    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByTestId('annual-report-due-row')).toHaveTextContent(
      '09/30 (Due non-audit years)',
    );
    expect(screen.getByTestId('lease-expiration-row')).toHaveTextContent('06/03/2023');
    expect(screen.getByTestId('past-background-question-row')).toHaveTextContent('06/03/2023');
    expect(screen.getByTestId('id-expiration-row')).toHaveTextContent('06/03/2023');
  });

  test('shows "No date added" for the editable fields when there is no key dates document', () => {
    renderCard(null);

    expect(screen.getByTestId('lease-expiration-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('past-background-question-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('id-expiration-row')).toHaveTextContent('No date added');
  });

  test('always shows the fixed Annual Report Due to OO value, even with no data', () => {
    renderCard(null);

    expect(screen.getByTestId('annual-report-due-row')).toHaveTextContent(
      '09/30 (Due non-audit years)',
    );
  });

  test('shows a loading spinner while loading', () => {
    renderCard(null, true);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });

  test('never renders a completion-status tag', () => {
    renderCard();

    expect(screen.queryAllByTestId(/^tag-/)).toHaveLength(0);
  });

  test('renders an Edit button when user has TrusteeAdmin role', () => {
    renderCard();

    expect(
      screen.getByTestId('button-edit-chapter12-standing-other-key-dates-appointment-001'),
    ).toBeInTheDocument();
  });

  test('does not render an Edit button when user lacks TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    renderCard();

    expect(
      screen.queryByTestId('button-edit-chapter12-standing-other-key-dates-appointment-001'),
    ).not.toBeInTheDocument();
  });

  test('navigates to the Other key dates edit form', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(
      screen.getByTestId('button-edit-chapter12-standing-other-key-dates-appointment-001'),
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      '/trustees/trustee-123/appointments/appointment-001/chapter12-standing-other-key-dates/edit',
    );
  });
});
