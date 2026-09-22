import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Chapter12StandingAuditCard from './Chapter12StandingAuditCard';
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

describe('Chapter12StandingAuditCard', () => {
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
    pastAudit: '2023-02-04',
    lastAuditFiscalYear: 2023,
    auditCompletionYear: 2026,
    auditCompletionStatus: 'CLOSED',
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
        <Chapter12StandingAuditCard
          trusteeId="trustee-123"
          appointmentId="appointment-001"
          data={data}
          isLoading={isLoading}
        />
      </BrowserRouter>,
    );
  }

  test('renders the Audit title and its columns', () => {
    renderCard();

    expect(screen.getByText('Audit')).toBeInTheDocument();
    expect(screen.getByTestId('audit-req-by-row')).toHaveTextContent('2026');
    expect(screen.getByTestId('past-audit-row')).toHaveTextContent('02/04/2023');
    expect(screen.getByTestId('past-last-audit-fiscal-year-row')).toHaveTextContent('2023');
  });

  test('shows a "Closed for {year}" tag when the appointment is closed for that year', () => {
    renderCard();

    expect(screen.getByTestId('tag-audit-completion-status-tag-appointment-001')).toHaveTextContent(
      'Closed for 2026',
    );
  });

  test('shows a "Not Closed for {year}" tag when not closed for that year', () => {
    renderCard({ ...keyDates, auditCompletionStatus: 'NOT_CLOSED' });

    expect(screen.getByTestId('tag-audit-completion-status-tag-appointment-001')).toHaveTextContent(
      'Not Closed for 2026',
    );
  });

  test('shows no tag when no completion status has been recorded', () => {
    renderCard({
      ...keyDates,
      auditCompletionYear: undefined,
      auditCompletionStatus: undefined,
    });

    expect(
      screen.queryByTestId('tag-audit-completion-status-tag-appointment-001'),
    ).not.toBeInTheDocument();
  });

  test('shows "No date added" defaults when there is no key dates document', () => {
    renderCard(null);

    expect(screen.getByTestId('audit-req-by-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('past-audit-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('past-last-audit-fiscal-year-row')).toHaveTextContent(
      'No date added',
    );
  });

  test('shows a loading spinner while loading', () => {
    renderCard(null, true);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Audit')).not.toBeInTheDocument();
  });

  test('renders an Edit button when user has TrusteeAdmin role', () => {
    renderCard();

    expect(
      screen.getByTestId('button-edit-chapter12-standing-audit-appointment-001'),
    ).toBeInTheDocument();
  });

  test('does not render an Edit button when user lacks TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    renderCard();

    expect(
      screen.queryByTestId('button-edit-chapter12-standing-audit-appointment-001'),
    ).not.toBeInTheDocument();
  });

  test('navigates to the Audit key dates edit form', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByTestId('button-edit-chapter12-standing-audit-appointment-001'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/trustees/trustee-123/appointments/appointment-001/audit-key-dates/edit',
    );
  });
});
