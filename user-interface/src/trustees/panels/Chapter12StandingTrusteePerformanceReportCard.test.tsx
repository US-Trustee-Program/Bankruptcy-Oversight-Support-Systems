import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Chapter12StandingTrusteePerformanceReportCard from './Chapter12StandingTrusteePerformanceReportCard';
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

describe('Chapter12StandingTrusteePerformanceReportCard', () => {
  let mockNavigate: ReturnType<typeof vi.fn>;

  const keyDates: TrusteeUpcomingKeyDates = {
    id: 'key-dates-002',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-123',
    appointmentId: 'appointment-001',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    tprReviewPeriodStart: '2026-04-01',
    tprReviewPeriodEnd: '2027-03-31',
    tprFrequency: 'ANNUAL',
    tprDue: '1900-10-06',
    tprDueYearType: 'EVEN',
    lastTprSubmitted: '2024-10-03',
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
    tprDisplayUpdates = true,
  ) {
    return render(
      <BrowserRouter>
        <Chapter12StandingTrusteePerformanceReportCard
          trusteeId="trustee-123"
          appointmentId="appointment-001"
          data={data}
          isLoading={isLoading}
          tprDisplayUpdates={tprDisplayUpdates}
        />
      </BrowserRouter>,
    );
  }

  test('renders the Trustee Performance Report title and all columns', () => {
    renderCard();

    expect(screen.getByText('Trustee Performance Report')).toBeInTheDocument();
    expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent(
      '04/01/2026 - 03/31/2027',
    );
    expect(screen.getByTestId('tpr-review-period-frequency-row')).toHaveTextContent('One year');
    expect(screen.getByTestId('tpr-due-row')).toBeInTheDocument();
    expect(screen.getByTestId('last-tpr-submitted-row')).toHaveTextContent('10/03/2024');
  });

  test('shows "No date added" / "No frequency selected" when there is no key dates document', () => {
    renderCard(null);

    expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('tpr-review-period-frequency-row')).toHaveTextContent(
      'No frequency selected',
    );
    expect(screen.getByTestId('tpr-due-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('last-tpr-submitted-row')).toHaveTextContent('No date added');
  });

  test('shows a loading spinner while loading', () => {
    renderCard(null, true);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Trustee Performance Report')).not.toBeInTheDocument();
  });

  test('renders an Edit button when user has TrusteeAdmin role', () => {
    renderCard();

    expect(
      screen.getByTestId('button-edit-chapter12-standing-tpr-appointment-001'),
    ).toBeInTheDocument();
  });

  test('does not render an Edit button when user lacks TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    renderCard();

    expect(
      screen.queryByTestId('button-edit-chapter12-standing-tpr-appointment-001'),
    ).not.toBeInTheDocument();
  });

  test('navigates to the TPR key dates edit form', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByTestId('button-edit-chapter12-standing-tpr-appointment-001'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/trustees/trustee-123/appointments/appointment-001/chapter12-standing-tpr-key-dates/edit',
    );
  });

  test('shows a "Complete for <year>" tag when tprCompletionStatus is COMPLETE', () => {
    renderCard({ ...keyDates, tprCompletionYear: 2025, tprCompletionStatus: 'COMPLETE' });

    expect(screen.getByTestId('tag-tpr-completion-status-tag-appointment-001')).toHaveTextContent(
      'Complete for 2025',
    );
  });

  test('shows an "Incomplete for <year>" tag when tprCompletionStatus is INCOMPLETE', () => {
    renderCard({ ...keyDates, tprCompletionYear: 2026, tprCompletionStatus: 'INCOMPLETE' });

    expect(screen.getByTestId('tag-tpr-completion-status-tag-appointment-001')).toHaveTextContent(
      'Incomplete for 2026',
    );
  });

  test('shows no tag when completion status is not set', () => {
    renderCard({ ...keyDates, tprCompletionYear: undefined, tprCompletionStatus: undefined });

    expect(
      screen.queryByTestId('tag-tpr-completion-status-tag-appointment-001'),
    ).not.toBeInTheDocument();
  });

  describe('when TPR_DISPLAY_UPDATES flag is off', () => {
    test('hides the frequency row', () => {
      renderCard(keyDates, false, false);

      expect(screen.queryByTestId('tpr-review-period-frequency-row')).not.toBeInTheDocument();
    });

    test('shows MM/DD + year-type for tprDue instead of calculated year', () => {
      renderCard(keyDates, false, false);

      expect(screen.getByTestId('tpr-due-row')).toHaveTextContent('10/06 EVEN');
    });

    test('shows MM/DD range for tprReviewPeriod instead of full YYYY range', () => {
      renderCard(keyDates, false, false);

      expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('04/01 - 03/31');
    });

    test('shows "No date added" for tprDue and tprReviewPeriod when data is null', () => {
      renderCard(null, false, false);

      expect(screen.getByTestId('tpr-due-row')).toHaveTextContent('No date added');
      expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('No date added');
    });
  });
});
