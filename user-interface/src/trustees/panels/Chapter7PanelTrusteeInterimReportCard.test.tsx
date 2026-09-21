import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Chapter7PanelTrusteeInterimReportCard from './Chapter7PanelTrusteeInterimReportCard';
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

describe('Chapter7PanelTrusteeInterimReportCard', () => {
  let mockNavigate: ReturnType<typeof vi.fn>;

  const keyDates: TrusteeUpcomingKeyDates = {
    id: 'key-dates-005',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-123',
    appointmentId: 'appointment-001',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    tirReviewPeriodStart: '1900-01-01',
    tirReviewPeriodEnd: '1900-03-31',
    tirSubmission: '2026-01-30',
    tirReview: '2026-03-30',
    pastTprSubmission: '2026-06-06',
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
        <Chapter7PanelTrusteeInterimReportCard
          trusteeId="trustee-123"
          appointmentId="appointment-001"
          data={data}
          isLoading={isLoading}
        />
      </BrowserRouter>,
    );
  }

  test('renders the Trustee Interim Report title, all four column headers, and their values', () => {
    renderCard();

    expect(screen.getByText('Trustee Interim Report')).toBeInTheDocument();
    expect(screen.getByText('TIR Review Period')).toBeInTheDocument();
    expect(screen.getByText('TIR Submission')).toBeInTheDocument();
    expect(screen.getByText('TIR Due')).toBeInTheDocument();
    expect(screen.getByText('Last TIR Letter')).toBeInTheDocument();
    expect(screen.getByTestId('tir-review-period-row')).toHaveTextContent('01/01 - 03/31');
    expect(screen.getByTestId('tir-submission-row')).toHaveTextContent('01/30');
    expect(screen.getByTestId('tir-review-row')).toHaveTextContent('03/30');
    expect(screen.getByTestId('last-tir-letter-row')).toHaveTextContent('06/06/2026');
  });

  test('shows "No date added" for all fields when there is no key dates document', () => {
    renderCard(null);

    expect(screen.getByTestId('tir-review-period-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('tir-submission-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('tir-review-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('last-tir-letter-row')).toHaveTextContent('No date added');
  });

  test('shows a loading spinner while loading', () => {
    renderCard(null, true);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Trustee Interim Report')).not.toBeInTheDocument();
  });

  test('renders an Edit button when user has TrusteeAdmin role', () => {
    renderCard();

    expect(
      screen.getByTestId('button-edit-chapter7-panel-tir-appointment-001'),
    ).toBeInTheDocument();
  });

  test('does not render an Edit button when user lacks TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    renderCard();

    expect(
      screen.queryByTestId('button-edit-chapter7-panel-tir-appointment-001'),
    ).not.toBeInTheDocument();
  });

  test('navigates to the TIR key dates edit form', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByTestId('button-edit-chapter7-panel-tir-appointment-001'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/trustees/trustee-123/appointments/appointment-001/tir-key-dates/edit',
    );
  });

  test('shows a "Complete for <year>" tag when tirCompletionStatus is COMPLETE', () => {
    renderCard({ ...keyDates, tirCompletionYear: 2025, tirCompletionStatus: 'COMPLETE' });

    expect(screen.getByTestId('tag-tir-completion-status-tag-appointment-001')).toHaveTextContent(
      'Complete for 2025',
    );
  });

  test('shows an "Incomplete for <year>" tag when tirCompletionStatus is INCOMPLETE', () => {
    renderCard({ ...keyDates, tirCompletionYear: 2024, tirCompletionStatus: 'INCOMPLETE' });

    expect(screen.getByTestId('tag-tir-completion-status-tag-appointment-001')).toHaveTextContent(
      'Incomplete for 2024',
    );
  });

  test('shows no tag when completion status is not set', () => {
    renderCard({ ...keyDates, tirCompletionYear: undefined, tirCompletionStatus: undefined });

    expect(
      screen.queryByTestId('tag-tir-completion-status-tag-appointment-001'),
    ).not.toBeInTheDocument();
  });

  test('shows no tag when only the year is set', () => {
    renderCard({ ...keyDates, tirCompletionYear: 2025, tirCompletionStatus: undefined });

    expect(
      screen.queryByTestId('tag-tir-completion-status-tag-appointment-001'),
    ).not.toBeInTheDocument();
  });

  test('shows no tag when only the status is set', () => {
    renderCard({ ...keyDates, tirCompletionYear: undefined, tirCompletionStatus: 'COMPLETE' });

    expect(
      screen.queryByTestId('tag-tir-completion-status-tag-appointment-001'),
    ).not.toBeInTheDocument();
  });
});
