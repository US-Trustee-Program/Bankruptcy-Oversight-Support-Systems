import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Chapter11SubVOtherKeyDatesCard from './Chapter11SubVOtherKeyDatesCard';
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

describe('Chapter11SubVOtherKeyDatesCard', () => {
  let mockNavigate: ReturnType<typeof vi.fn>;

  const keyDates: TrusteeUpcomingKeyDates = {
    id: 'key-dates-002',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-789',
    appointmentId: 'appointment-003',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    lastMonthlyReportReceived: '2024-11-15',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate = vi.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
  });

  function renderCard(
    data: TrusteeUpcomingKeyDates | null = keyDates,
    isLoading = false,
    appointmentHeading?: string,
  ) {
    return render(
      <BrowserRouter>
        <Chapter11SubVOtherKeyDatesCard
          trusteeId="trustee-789"
          appointmentId="appointment-003"
          appointmentHeading={appointmentHeading}
          data={data}
          isLoading={isLoading}
        />
      </BrowserRouter>,
    );
  }

  test('renders the last monthly report received date', () => {
    renderCard();

    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByTestId('past-last-monthly-report-received-row')).toHaveTextContent(
      '11/15/2024',
    );
  });

  test('shows "No date added" when the date is missing', () => {
    renderCard({ ...keyDates, lastMonthlyReportReceived: undefined });

    expect(screen.getByText('No date added')).toBeInTheDocument();
  });

  test('shows "No date added" when there is no key dates document', () => {
    renderCard(null);

    expect(screen.getByText('No date added')).toBeInTheDocument();
  });

  test('shows a loading spinner while loading', () => {
    renderCard(null, true);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });

  test('renders an Edit button when user has TrusteeAdmin role', () => {
    renderCard();

    expect(
      screen.getByTestId('button-edit-subv-other-key-dates-appointment-003'),
    ).toBeInTheDocument();
  });

  test('does not render an Edit button when user lacks TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    renderCard();

    expect(
      screen.queryByTestId('button-edit-subv-other-key-dates-appointment-003'),
    ).not.toBeInTheDocument();
  });

  test('navigates to the past key dates edit form with the subv-pool variant and appointment heading as subHeading', async () => {
    const user = userEvent.setup();
    renderCard(keyDates, false, 'District of Alaska (All): Chapter 11 Subchapter V - Pool');

    await user.click(screen.getByTestId('button-edit-subv-other-key-dates-appointment-003'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/trustees/trustee-789/appointments/appointment-003/past-key-dates/edit',
      {
        state: {
          subHeading: 'District of Alaska (All): Chapter 11 Subchapter V - Pool',
          variant: 'subv-pool',
        },
      },
    );
  });

  test('navigates with an empty subHeading when no appointmentHeading is provided', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByTestId('button-edit-subv-other-key-dates-appointment-003'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/trustees/trustee-789/appointments/appointment-003/past-key-dates/edit',
      { state: { subHeading: '', variant: 'subv-pool' } },
    );
  });
});
