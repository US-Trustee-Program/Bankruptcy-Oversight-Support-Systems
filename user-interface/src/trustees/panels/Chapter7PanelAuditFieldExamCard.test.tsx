import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Chapter7PanelAuditFieldExamCard from './Chapter7PanelAuditFieldExamCard';
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

describe('Chapter7PanelAuditFieldExamCard', () => {
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
    upcomingExamOrAuditYear: 2026,
    upcomingExamOrAuditType: 'Audit',
    lastAuditFiscalYear: 2023,
    pastAudit: '2023-02-04',
    pastFieldExam: '2025-04-12',
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
        <Chapter7PanelAuditFieldExamCard
          trusteeId="trustee-123"
          appointmentId="appointment-001"
          data={data}
          isLoading={isLoading}
        />
      </BrowserRouter>,
    );
  }

  test('renders the Audit/Field Exam title and all five columns', () => {
    renderCard();

    expect(screen.getByText('Audit/Field Exam')).toBeInTheDocument();
    expect(screen.getByTestId('upcoming-exam-audit-row')).toHaveTextContent('2026');
    expect(screen.getByTestId('audit-req-by-row')).toHaveTextContent('2026');
    expect(screen.getByTestId('past-last-audit-fiscal-year-row')).toHaveTextContent('2023');
    expect(screen.getByTestId('past-audit-row')).toHaveTextContent('02/04/2023');
    expect(screen.getByTestId('past-field-exam-row')).toHaveTextContent('04/12/2025');
  });

  test.each([['Audit'], ['Field Exam'], [undefined]] as const)(
    'always labels the first column "Audit", regardless of upcomingExamOrAuditType %s',
    (upcomingExamOrAuditType) => {
      renderCard({ ...keyDates, upcomingExamOrAuditType });

      expect(screen.getByText('Audit')).toBeInTheDocument();
    },
  );

  test('shows "No date added" for missing fields', () => {
    renderCard({
      ...keyDates,
      upcomingExamOrAuditYear: undefined,
      lastAuditFiscalYear: undefined,
      pastAudit: undefined,
      pastFieldExam: undefined,
    });

    // Audit Req by is also calculated from lastAuditFiscalYear, so clearing that
    // field blanks both the "Last Audit's Fiscal Year" and "Audit Req by" columns.
    expect(screen.getAllByText('No date added')).toHaveLength(5);
  });

  test('shows "No date added" for all fields when there is no key dates document', () => {
    renderCard(null);

    expect(screen.getAllByText('No date added')).toHaveLength(5);
  });

  test('shows a loading spinner while loading', () => {
    renderCard(null, true);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Audit/Field Exam')).not.toBeInTheDocument();
  });

  test('renders an Edit button when user has TrusteeAdmin role', () => {
    renderCard();

    expect(
      screen.getByTestId('button-edit-chapter7-panel-audit-field-exam-appointment-001'),
    ).toBeInTheDocument();
  });

  test('does not render an Edit button when user lacks TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    renderCard();

    expect(
      screen.queryByTestId('button-edit-chapter7-panel-audit-field-exam-appointment-001'),
    ).not.toBeInTheDocument();
  });

  test('navigates to the Audit/Field Exam edit form', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(
      screen.getByTestId('button-edit-chapter7-panel-audit-field-exam-appointment-001'),
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      '/trustees/trustee-123/appointments/appointment-001/audit-field-exam-key-dates/edit',
    );
  });

  test('shows a "Complete for <year>" tag when completion status is CLOSED', () => {
    renderCard({ ...keyDates, auditCompletionYear: 2023, auditCompletionStatus: 'CLOSED' });

    expect(screen.getByTestId('tag-audit-completion-status-tag-appointment-001')).toHaveTextContent(
      'Complete for 2023',
    );
  });

  test('shows an "Incomplete for <year>" tag when completion status is NOT_CLOSED', () => {
    renderCard({ ...keyDates, auditCompletionYear: 2024, auditCompletionStatus: 'NOT_CLOSED' });

    expect(screen.getByTestId('tag-audit-completion-status-tag-appointment-001')).toHaveTextContent(
      'Incomplete for 2024',
    );
  });

  test('shows no tag when completion status is not set', () => {
    renderCard({ ...keyDates, auditCompletionYear: undefined, auditCompletionStatus: undefined });

    expect(
      screen.queryByTestId('tag-audit-completion-status-tag-appointment-001'),
    ).not.toBeInTheDocument();
  });

  test('shows no tag when only the year is set', () => {
    renderCard({ ...keyDates, auditCompletionYear: 2023, auditCompletionStatus: undefined });

    expect(
      screen.queryByTestId('tag-audit-completion-status-tag-appointment-001'),
    ).not.toBeInTheDocument();
  });
});
