import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Chapter7PanelAuditFieldExamForm, {
  buildAuditFieldExamKeyDatesInput,
} from './Chapter7PanelAuditFieldExamForm';
import Api2 from '@/lib/models/api2';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { CamsRole } from '@common/cams/roles';
import { GlobalAlertContext } from '@/App';

const mockUseNavigate = vi.hoisted(() => vi.fn());
const mockUseParams = vi.hoisted(() =>
  vi.fn(() => ({ trusteeId: 'trustee-001', appointmentId: 'appointment-001' })),
);

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: mockUseNavigate,
    useParams: mockUseParams,
  };
});

const populatedDocument: TrusteeUpcomingKeyDates = {
  id: 'doc-001',
  documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
  trusteeId: 'trustee-001',
  appointmentId: 'appointment-001',
  createdBy: SYSTEM_USER_REFERENCE,
  createdOn: '2026-01-01T00:00:00.000Z',
  updatedBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2026-01-01T00:00:00.000Z',
  upcomingExamOrAuditYear: 2026,
  upcomingExamOrAuditType: 'Audit',
  pastAudit: '2023-02-04',
  lastAuditFiscalYear: 2023,
  pastFieldExam: '2025-04-12',
  auditCompletionYear: 2023,
  auditCompletionStatus: 'CLOSED',
  pastBackgroundQuestion: '2023-06-03',
};

const mockGlobalAlertRef = {
  current: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    clear: vi.fn(),
  },
};

function renderComponent() {
  return render(
    <BrowserRouter>
      <GlobalAlertContext.Provider value={mockGlobalAlertRef}>
        <Chapter7PanelAuditFieldExamForm />
      </GlobalAlertContext.Provider>
    </BrowserRouter>,
  );
}

describe('Chapter7PanelAuditFieldExamForm', () => {
  const mockNavigate = vi.fn();
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    mockGlobalAlertRef.current.error.mockClear();
    mockUseNavigate.mockReturnValue(mockNavigate);
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
    userEvent = TestingUtilities.setupUserEvent();
  });

  test('shows forbidden message when user lacks TrusteeAdmin role', async () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    const forbiddenAlert = await screen.findByTestId('alert-forbidden-alert');
    expect(forbiddenAlert).toBeInTheDocument();
    expect(forbiddenAlert).toHaveTextContent('Forbidden');
    expect(forbiddenAlert).toHaveTextContent(
      'You do not have permission to manage Trustee Audit/Field Exam Key Dates',
    );
  });

  test('shows loading spinner while fetching', () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockImplementation(() => new Promise(() => {}));

    renderComponent();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-chapter7-panel-audit-field-exam')).not.toBeInTheDocument();
  });

  test('pre-populates form from API response', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-exam-audit-year')).toHaveValue('2026');
    });
    expect(screen.getByTestId('upcoming-exam-audit-type')).toHaveValue('Audit');
    expect(screen.getByTestId('past-audit')).toHaveValue('2023-02-04');
    expect(screen.getByTestId('last-audit-fiscal-year')).toHaveValue('2023');
    expect(screen.getByTestId('past-field-exam')).toHaveValue('2025-04-12');
    expect(screen.getByTestId('audit-completion-status-year')).toHaveValue('2023');
    expect(screen.getByTestId('audit-completion-status-status')).toHaveValue('CLOSED');
  });

  test('shows empty inputs when API returns null', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-chapter7-panel-audit-field-exam')).toBeInTheDocument();
    });
    expect(screen.getByTestId('upcoming-exam-audit-year')).toHaveValue('');
    expect(screen.getByTestId('upcoming-exam-audit-type')).toHaveValue('');
    expect(screen.getByTestId('past-audit')).toHaveValue('');
    expect(screen.getByTestId('last-audit-fiscal-year')).toHaveValue('');
    expect(screen.getByTestId('past-field-exam')).toHaveValue('');
    expect(screen.getByTestId('audit-completion-status-year')).toHaveValue('');
    expect(screen.getByTestId('audit-completion-status-status')).toHaveValue('');
  });

  test('save calls PUT with all owned fields while preserving other fields, then navigates', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('past-audit')).toHaveValue('2023-02-04'));

    await userEvent.click(screen.getByTestId('button-save-chapter7-panel-audit-field-exam'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          trusteeId: 'trustee-001',
          appointmentId: 'appointment-001',
          upcomingExamOrAuditYear: 2026,
          upcomingExamOrAuditType: 'Audit',
          pastAudit: '2023-02-04',
          lastAuditFiscalYear: 2023,
          pastFieldExam: '2025-04-12',
          auditCompletionYear: 2023,
          auditCompletionStatus: 'CLOSED',
          pastBackgroundQuestion: '2023-06-03',
        }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });

  test('changing the select fields updates form state and is captured in the save payload', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('past-audit')).toHaveValue('2023-02-04'));

    await userEvent.selectOptions(screen.getByTestId('upcoming-exam-audit-year'), '2027');
    await userEvent.selectOptions(screen.getByTestId('upcoming-exam-audit-type'), 'Field Exam');
    await userEvent.selectOptions(screen.getByTestId('last-audit-fiscal-year'), '2022');
    await userEvent.selectOptions(screen.getByTestId('audit-completion-status-year'), '2024');
    await userEvent.selectOptions(
      screen.getByTestId('audit-completion-status-status'),
      'NOT_CLOSED',
    );

    expect(screen.getByTestId('upcoming-exam-audit-year')).toHaveValue('2027');
    expect(screen.getByTestId('upcoming-exam-audit-type')).toHaveValue('Field Exam');
    expect(screen.getByTestId('last-audit-fiscal-year')).toHaveValue('2022');
    expect(screen.getByTestId('audit-completion-status-year')).toHaveValue('2024');
    expect(screen.getByTestId('audit-completion-status-status')).toHaveValue('NOT_CLOSED');

    await userEvent.click(screen.getByTestId('button-save-chapter7-panel-audit-field-exam'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          upcomingExamOrAuditYear: 2027,
          upcomingExamOrAuditType: 'Field Exam',
          lastAuditFiscalYear: 2022,
          auditCompletionYear: 2024,
          auditCompletionStatus: 'NOT_CLOSED',
        }),
      );
    });
  });

  test('shows inline error alert when key dates fail to load', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('Network error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-chapter7-panel-audit-field-exam')).toBeInTheDocument();
    });
    expect(mockGlobalAlertRef.current.error).toHaveBeenCalledWith(
      'Failed to load Audit/Field Exam key dates: Network error',
    );
  });

  test('shows error alert when save fails and re-enables save button', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    vi.spyOn(Api2, 'putUpcomingKeyDates').mockRejectedValue(new Error('Server error'));

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('past-audit')).toHaveValue('2023-02-04'));

    await userEvent.click(screen.getByTestId('button-save-chapter7-panel-audit-field-exam'));

    await waitFor(() => {
      const saveButton = screen.getByTestId('button-save-chapter7-panel-audit-field-exam');
      expect(saveButton).not.toBeDisabled();
      expect(saveButton).toHaveTextContent('Save');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockGlobalAlertRef.current.error).toHaveBeenCalledWith(
      'Failed to save Audit/Field Exam key dates: Server error',
    );
  });

  test.each(['past-audit', 'past-field-exam'])(
    'Save button is disabled when %s has an invalid date',
    async (testId) => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId(testId), {
        target: { value: '1900-01-01' },
      });

      await waitFor(() => {
        expect(screen.getByTestId('button-save-chapter7-panel-audit-field-exam')).toBeDisabled();
      });
    },
  );

  test('Save button is disabled and shows a message when only the completion status year is cleared', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('audit-completion-status-year')).toHaveValue('2023'),
    );

    await userEvent.selectOptions(screen.getByTestId('audit-completion-status-year'), '');

    await waitFor(() => {
      expect(screen.getByTestId('audit-completion-status-error')).toHaveTextContent(
        'Field Exam/Audit Completion Status Year and Status must both be set.',
      );
      expect(screen.getByTestId('button-save-chapter7-panel-audit-field-exam')).toBeDisabled();
    });
  });

  test('Save button is disabled and shows a message when only the completion status status is cleared', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('audit-completion-status-status')).toHaveValue('CLOSED'),
    );

    await userEvent.selectOptions(screen.getByTestId('audit-completion-status-status'), '');

    await waitFor(() => {
      expect(screen.getByTestId('audit-completion-status-error')).toHaveTextContent(
        'Field Exam/Audit Completion Status Year and Status must both be set.',
      );
      expect(screen.getByTestId('button-save-chapter7-panel-audit-field-exam')).toBeDisabled();
    });
  });

  test('Save button is disabled and shows a message when only the exam/audit year is cleared', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('upcoming-exam-audit-year')).toHaveValue('2026'));

    await userEvent.selectOptions(screen.getByTestId('upcoming-exam-audit-year'), '');

    await waitFor(() => {
      expect(screen.getByTestId('exam-audit-pair-error')).toHaveTextContent(
        'Field Exam or Audit Year and Type must both be set.',
      );
      expect(screen.getByTestId('button-save-chapter7-panel-audit-field-exam')).toBeDisabled();
    });
  });

  test('Save button is disabled and shows a message when only the exam/audit type is cleared', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('upcoming-exam-audit-type')).toHaveValue('Audit'),
    );

    await userEvent.selectOptions(screen.getByTestId('upcoming-exam-audit-type'), '');

    await waitFor(() => {
      expect(screen.getByTestId('exam-audit-pair-error')).toHaveTextContent(
        'Field Exam or Audit Year and Type must both be set.',
      );
      expect(screen.getByTestId('button-save-chapter7-panel-audit-field-exam')).toBeDisabled();
    });
  });

  test('resetting both completion status fields back to blank clears them from the save payload', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('audit-completion-status-year')).toHaveValue('2023'),
    );

    await userEvent.selectOptions(screen.getByTestId('audit-completion-status-year'), '');
    await userEvent.selectOptions(screen.getByTestId('audit-completion-status-status'), '');

    await userEvent.click(screen.getByTestId('button-save-chapter7-panel-audit-field-exam'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          auditCompletionYear: null,
          auditCompletionStatus: null,
        }),
      );
    });
  });

  test('cancel navigates back to the appointments page without saving', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('past-audit')).toHaveValue('2023-02-04'));

    await userEvent.click(screen.getByTestId('button-cancel-chapter7-panel-audit-field-exam'));

    expect(putSpy).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });
});

describe('buildAuditFieldExamKeyDatesInput', () => {
  const fullOriginal: TrusteeUpcomingKeyDates = {
    id: 'doc-full',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-001',
    appointmentId: 'appointment-001',
    createdBy: SYSTEM_USER_REFERENCE,
    createdOn: '2026-01-01T00:00:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2026-01-01T00:00:00.000Z',
    pastBackgroundQuestion: '2020-01-01',
    pastFieldExam: '2020-01-02',
    pastAudit: '2020-01-03',
    pastTprSubmission: '2020-01-04',
    lastTprSubmitted: '2020-01-22',
    tprReviewPeriodStart: '2020-01-05',
    tprReviewPeriodEnd: '2020-01-06',
    tprDue: '2020-01-07',
    tprDueYearType: 'EVEN',
    tprFrequency: 'ANNUAL',
    tirReviewPeriodStart: '2020-01-08',
    tirReviewPeriodEnd: '2020-01-09',
    tirSubmission: '2020-01-10',
    tirReview: '2020-01-11',
    upcomingExamOrAuditYear: 2024,
    upcomingExamOrAuditType: 'Field Exam',
    tirFrequency: 'SEMI_ANNUAL',
    tirSemiAnnualReviewPeriodStart: '2020-01-12',
    tirSemiAnnualReviewPeriodEnd: '2020-01-13',
    tirSemiAnnualSubmission: '2020-01-14',
    tirSemiAnnualReview: '2020-01-15',
    lastAuditFiscalYear: 2021,
    auditCompletionYear: 2021,
    auditCompletionStatus: 'NOT_CLOSED',
    tprCompletionYear: 2022,
    tprCompletionStatus: 'INCOMPLETE',
    tirCompletionYear: 2023,
    tirCompletionStatus: 'COMPLETE',
    lastMonthlyReportReceived: '2020-01-16',
    leaseExpiration: '2020-01-17',
    idExpiration: '2020-01-18',
    lastCompensationStudy: '2020-01-19',
    bondIssuedDate: '2020-01-20',
    bondRenewalDate: '2020-01-21',
  };

  test('preserves every non-owned field from the original document and overrides only this card fields', () => {
    const result = buildAuditFieldExamKeyDatesInput(
      { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
      fullOriginal,
      {
        upcomingExamOrAuditYear: 2026,
        upcomingExamOrAuditType: 'Audit',
        pastAudit: '2023-02-04',
        lastAuditFiscalYear: 2023,
        pastFieldExam: '2025-04-12',
        auditCompletionYear: 2023,
        auditCompletionStatus: 'CLOSED',
      },
    );

    expect(result).toEqual({
      trusteeId: 'trustee-001',
      appointmentId: 'appointment-001',
      pastBackgroundQuestion: '2020-01-01',
      pastFieldExam: '2025-04-12',
      pastAudit: '2023-02-04',
      pastTprSubmission: '2020-01-04',
      lastTprSubmitted: '2020-01-22',
      tprReviewPeriodStart: '2020-01-05',
      tprReviewPeriodEnd: '2020-01-06',
      tprDue: '2020-01-07',
      tprDueYearType: 'EVEN',
      tprFrequency: 'ANNUAL',
      tirReviewPeriodStart: '2020-01-08',
      tirReviewPeriodEnd: '2020-01-09',
      tirSubmission: '2020-01-10',
      tirReview: '2020-01-11',
      upcomingExamOrAuditYear: 2026,
      upcomingExamOrAuditType: 'Audit',
      tirFrequency: 'SEMI_ANNUAL',
      tirSemiAnnualReviewPeriodStart: '2020-01-12',
      tirSemiAnnualReviewPeriodEnd: '2020-01-13',
      tirSemiAnnualSubmission: '2020-01-14',
      tirSemiAnnualReview: '2020-01-15',
      lastAuditFiscalYear: 2023,
      auditCompletionYear: 2023,
      auditCompletionStatus: 'CLOSED',
      tprCompletionYear: 2022,
      tprCompletionStatus: 'INCOMPLETE',
      tirCompletionYear: 2023,
      tirCompletionStatus: 'COMPLETE',
      lastMonthlyReportReceived: '2020-01-16',
      leaseExpiration: '2020-01-17',
      idExpiration: '2020-01-18',
      lastCompensationStudy: '2020-01-19',
      bondIssuedDate: '2020-01-20',
      bondRenewalDate: '2020-01-21',
    });
  });

  test('defaults every field to null when there is no original document and the form is empty', () => {
    const result = buildAuditFieldExamKeyDatesInput(
      { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
      null,
      {
        upcomingExamOrAuditYear: '',
        upcomingExamOrAuditType: '',
        pastAudit: '',
        lastAuditFiscalYear: '',
        pastFieldExam: '',
        auditCompletionYear: '',
        auditCompletionStatus: '',
      },
    );

    expect(result).toEqual({
      trusteeId: 'trustee-001',
      appointmentId: 'appointment-001',
      pastBackgroundQuestion: null,
      pastFieldExam: null,
      pastAudit: null,
      pastTprSubmission: null,
      lastTprSubmitted: null,
      tprReviewPeriodStart: null,
      tprReviewPeriodEnd: null,
      tprDue: null,
      tprDueYearType: null,
      tprFrequency: null,
      tirReviewPeriodStart: null,
      tirReviewPeriodEnd: null,
      tirSubmission: null,
      tirReview: null,
      upcomingExamOrAuditYear: null,
      upcomingExamOrAuditType: null,
      tirFrequency: null,
      tirSemiAnnualReviewPeriodStart: null,
      tirSemiAnnualReviewPeriodEnd: null,
      tirSemiAnnualSubmission: null,
      tirSemiAnnualReview: null,
      lastAuditFiscalYear: null,
      auditCompletionYear: null,
      auditCompletionStatus: null,
      tprCompletionYear: null,
      tprCompletionStatus: null,
      tirCompletionYear: null,
      tirCompletionStatus: null,
      lastMonthlyReportReceived: null,
      leaseExpiration: null,
      idExpiration: null,
      lastCompensationStudy: null,
      bondIssuedDate: null,
      bondRenewalDate: null,
    });
  });
});
