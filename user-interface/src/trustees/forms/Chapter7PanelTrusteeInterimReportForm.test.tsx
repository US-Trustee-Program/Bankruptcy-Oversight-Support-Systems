import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Chapter7PanelTrusteeInterimReportForm, {
  buildTrusteeInterimReportKeyDatesInput,
} from './Chapter7PanelTrusteeInterimReportForm';
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
  tirFrequency: 'ANNUAL',
  tirReviewPeriodStart: '1900-01-01',
  tirReviewPeriodEnd: '1900-12-31',
  tirSubmission: '1900-01-30',
  tirReview: '1900-03-30',
  tirCompletionYear: 2025,
  tirCompletionStatus: 'COMPLETE',
  pastTprSubmission: '2024-04-15',
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
        <Chapter7PanelTrusteeInterimReportForm />
      </GlobalAlertContext.Provider>
    </BrowserRouter>,
  );
}

describe('Chapter7PanelTrusteeInterimReportForm', () => {
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
      'You do not have permission to manage Trustee Interim Report Key Dates',
    );
  });

  test('shows loading spinner while fetching', () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockImplementation(() => new Promise(() => {}));

    renderComponent();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-chapter7-panel-tir')).not.toBeInTheDocument();
  });

  test('pre-populates form from API response for an ANNUAL period', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tir-frequency')).toHaveValue('ANNUAL');
    });
    expect(screen.getByTestId('tir-period')).toHaveValue('01/01-12/31');
    expect(screen.getByTestId('tir-completion-status-year')).toHaveValue('2025');
    expect(screen.getByTestId('tir-completion-status-status')).toHaveValue('COMPLETE');
    expect(screen.getByTestId('past-tpr-submission')).toHaveValue('2024-04-15');
  });

  test('pre-populates form from API response for a SEMI_ANNUAL period', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({
      data: {
        ...populatedDocument,
        tirFrequency: 'SEMI_ANNUAL',
        tirReviewPeriodStart: '1900-01-01',
        tirReviewPeriodEnd: '1900-06-30',
        tirSemiAnnualReviewPeriodStart: '1900-07-01',
        tirSemiAnnualReviewPeriodEnd: '1900-12-31',
        tirSubmission: '1900-07-30',
        tirReview: '1900-09-28',
        tirSemiAnnualSubmission: '1900-01-30',
        tirSemiAnnualReview: '1900-03-30',
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tir-frequency')).toHaveValue('SEMI_ANNUAL');
    });
    expect(screen.getByTestId('tir-period')).toHaveValue('01/01-06/30 & 07/01-12/31');
  });

  test('shows empty inputs when API returns null', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-chapter7-panel-tir')).toBeInTheDocument();
    });
    expect(screen.getByTestId('tir-frequency')).toHaveValue('');
    expect(screen.getByTestId('tir-period')).toHaveValue('');
    expect(screen.getByTestId('tir-period')).toBeDisabled();
    expect(screen.getByTestId('tir-completion-status-year')).toHaveValue('');
    expect(screen.getByTestId('tir-completion-status-status')).toHaveValue('');
    expect(screen.getByTestId('past-tpr-submission')).toHaveValue('');
  });

  test('choosing a Frequency enables the Period select', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await screen.findByTestId('tir-frequency');

    await userEvent.selectOptions(screen.getByTestId('tir-frequency'), 'ANNUAL');
    expect(screen.getByTestId('tir-period')).not.toBeDisabled();

    await userEvent.selectOptions(screen.getByTestId('tir-period'), '04/01-03/31');

    expect(screen.getByTestId('tir-period')).toHaveValue('04/01-03/31');
  });

  test('changing Frequency clears the previously selected Period', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('tir-period')).toHaveValue('01/01-12/31'));

    await userEvent.selectOptions(screen.getByTestId('tir-frequency'), 'SEMI_ANNUAL');

    expect(screen.getByTestId('tir-period')).toHaveValue('');
  });

  test('resetting Period back to the placeholder clears the period without touching Frequency', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('tir-period')).toHaveValue('01/01-12/31'));

    await userEvent.selectOptions(screen.getByTestId('tir-period'), '');

    expect(screen.getByTestId('tir-frequency')).toHaveValue('ANNUAL');
    expect(screen.getByTestId('tir-period')).toHaveValue('');
  });

  test('pre-populates with an empty Period select when the stored period matches no known option', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({
      data: {
        ...populatedDocument,
        tirReviewPeriodStart: '1900-02-15',
        tirReviewPeriodEnd: '1900-05-14',
      },
    });

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('tir-frequency')).toHaveValue('ANNUAL'));

    expect(screen.getByTestId('tir-period')).toHaveValue('');
  });

  test('save calls PUT with owned fields recalculated from the period, preserving other fields', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('tir-period')).toHaveValue('01/01-12/31'));

    await userEvent.selectOptions(screen.getByTestId('tir-period'), '04/01-03/31');
    await userEvent.selectOptions(screen.getByTestId('tir-completion-status-year'), '2024');
    await userEvent.selectOptions(screen.getByTestId('tir-completion-status-status'), 'INCOMPLETE');
    fireEvent.change(screen.getByTestId('past-tpr-submission'), {
      target: { value: '2024-05-20' },
    });

    await userEvent.click(screen.getByTestId('button-save-chapter7-panel-tir'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          trusteeId: 'trustee-001',
          appointmentId: 'appointment-001',
          tirFrequency: 'ANNUAL',
          tirReviewPeriodStart: '1900-04-01',
          tirReviewPeriodEnd: '1900-03-31',
          tirSubmission: '1900-04-30',
          tirReview: '1900-06-29',
          tirSemiAnnualReviewPeriodStart: null,
          tirSemiAnnualReviewPeriodEnd: null,
          tirSemiAnnualSubmission: null,
          tirSemiAnnualReview: null,
          tirCompletionYear: 2024,
          tirCompletionStatus: 'INCOMPLETE',
          pastTprSubmission: '2024-05-20',
        }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });

  test('shows inline error alert when key dates fail to load', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('Network error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-chapter7-panel-tir')).toBeInTheDocument();
    });
    expect(mockGlobalAlertRef.current.error).toHaveBeenCalledWith(
      'Failed to load Trustee Interim Report key dates: Network error',
    );
  });

  test('shows error alert when save fails and re-enables save button', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    vi.spyOn(Api2, 'putUpcomingKeyDates').mockRejectedValue(new Error('Server error'));

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('tir-period')).toHaveValue('01/01-12/31'));

    await userEvent.click(screen.getByTestId('button-save-chapter7-panel-tir'));

    await waitFor(() => {
      const saveButton = screen.getByTestId('button-save-chapter7-panel-tir');
      expect(saveButton).not.toBeDisabled();
      expect(saveButton).toHaveTextContent('Save');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockGlobalAlertRef.current.error).toHaveBeenCalledWith(
      'Failed to save Trustee Interim Report key dates: Server error',
    );
  });

  test('Save button shows Saving... and is disabled while the save request is in flight', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    vi.spyOn(Api2, 'putUpcomingKeyDates').mockImplementation(() => new Promise<never>(() => {}));

    renderComponent();
    await waitFor(() => expect(screen.getByTestId('tir-period')).toHaveValue('01/01-12/31'));

    await userEvent.click(screen.getByTestId('button-save-chapter7-panel-tir'));

    await waitFor(() => {
      const saveButton = screen.getByTestId('button-save-chapter7-panel-tir');
      expect(saveButton).toBeDisabled();
      expect(saveButton).toHaveTextContent('Saving...');
    });
  });

  test('Save button is disabled when past-tpr-submission has an invalid date', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();
    await screen.findByTestId('past-tpr-submission');

    fireEvent.change(screen.getByTestId('past-tpr-submission'), {
      target: { value: '1900-01-01' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('button-save-chapter7-panel-tir')).toBeDisabled();
    });
  });

  test('Save button is disabled and shows a message when only the completion status year is cleared', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('tir-completion-status-year')).toHaveValue('2025'),
    );

    await userEvent.selectOptions(screen.getByTestId('tir-completion-status-year'), '');

    expect(screen.queryByTestId('tir-completion-status-error')).not.toBeInTheDocument();

    fireEvent.blur(screen.getByTestId('tir-completion-status-year'), { relatedTarget: null });

    await waitFor(() => {
      expect(screen.getByTestId('tir-completion-status-error')).toHaveTextContent(
        'Trustee Interim Report Completion Status Year and Status must both be set.',
      );
      expect(screen.getByTestId('button-save-chapter7-panel-tir')).toBeDisabled();
    });
  });

  test('Save button is disabled and shows a message when only the completion status status is cleared', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('tir-completion-status-status')).toHaveValue('COMPLETE'),
    );

    await userEvent.selectOptions(screen.getByTestId('tir-completion-status-status'), '');

    expect(screen.queryByTestId('tir-completion-status-error')).not.toBeInTheDocument();

    fireEvent.blur(screen.getByTestId('tir-completion-status-status'), { relatedTarget: null });

    await waitFor(() => {
      expect(screen.getByTestId('tir-completion-status-error')).toHaveTextContent(
        'Trustee Interim Report Completion Status Year and Status must both be set.',
      );
      expect(screen.getByTestId('button-save-chapter7-panel-tir')).toBeDisabled();
    });
  });

  test('Save button is disabled and shows a message when Frequency is chosen but Period is left blank', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await screen.findByTestId('tir-frequency');

    await userEvent.selectOptions(screen.getByTestId('tir-frequency'), 'ANNUAL');

    expect(screen.queryByTestId('tir-period-pair-error')).not.toBeInTheDocument();

    fireEvent.blur(screen.getByTestId('tir-frequency'), { relatedTarget: null });

    await waitFor(() => {
      expect(screen.getByTestId('tir-period-pair-error')).toHaveTextContent(
        'Trustee Interim Report (TIR) Period Frequency and Period must both be set.',
      );
      expect(screen.getByTestId('button-save-chapter7-panel-tir')).toBeDisabled();
    });
  });

  test('Save button is disabled and shows a message when Period is cleared back to the placeholder', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('tir-period')).toHaveValue('01/01-12/31'));

    await userEvent.selectOptions(screen.getByTestId('tir-period'), '');

    expect(screen.queryByTestId('tir-period-pair-error')).not.toBeInTheDocument();

    fireEvent.blur(screen.getByTestId('tir-period'), { relatedTarget: null });

    await waitFor(() => {
      expect(screen.getByTestId('tir-period-pair-error')).toHaveTextContent(
        'Trustee Interim Report (TIR) Period Frequency and Period must both be set.',
      );
      expect(screen.getByTestId('button-save-chapter7-panel-tir')).toBeDisabled();
    });
  });

  test('resetting both completion status fields back to blank clears them from the save payload', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('tir-completion-status-year')).toHaveValue('2025'),
    );

    await userEvent.selectOptions(screen.getByTestId('tir-completion-status-year'), '');
    await userEvent.selectOptions(screen.getByTestId('tir-completion-status-status'), '');

    await userEvent.click(screen.getByTestId('button-save-chapter7-panel-tir'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({ tirCompletionYear: null, tirCompletionStatus: null }),
      );
    });
  });

  test('cancel navigates back to the appointments page without saving', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('tir-period')).toHaveValue('01/01-12/31'));

    await userEvent.click(screen.getByTestId('button-cancel-chapter7-panel-tir'));

    expect(putSpy).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });
});

describe('buildTrusteeInterimReportKeyDatesInput', () => {
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
    tirFrequency: 'ANNUAL',
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
    tirCompletionStatus: 'INCOMPLETE',
    lastMonthlyReportReceived: '2020-01-16',
    leaseExpiration: '2020-01-17',
    idExpiration: '2020-01-18',
    lastCompensationStudy: '2020-01-19',
    bondIssuedDate: '2020-01-20',
    bondRenewalDate: '2020-01-21',
  };

  test('preserves every non-owned field from the original document and overrides only this card fields', () => {
    const result = buildTrusteeInterimReportKeyDatesInput(
      { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
      fullOriginal,
      {
        tirFrequency: 'ANNUAL',
        tirPeriodKey: '04/01-03/31',
        tirReviewPeriodStart: '1900-04-01',
        tirReviewPeriodEnd: '1900-03-31',
        tirSemiAnnualReviewPeriodStart: '',
        tirSemiAnnualReviewPeriodEnd: '',
        tirCompletionYear: 2025,
        tirCompletionStatus: 'COMPLETE',
        pastTprSubmission: '1900-05-05',
      },
    );

    expect(result).toEqual({
      trusteeId: 'trustee-001',
      appointmentId: 'appointment-001',
      pastBackgroundQuestion: '2020-01-01',
      pastFieldExam: '2020-01-02',
      pastAudit: '2020-01-03',
      pastTprSubmission: '1900-05-05',
      lastTprSubmitted: '2020-01-22',
      tprReviewPeriodStart: '2020-01-05',
      tprReviewPeriodEnd: '2020-01-06',
      tprDue: '2020-01-07',
      tprDueYearType: 'EVEN',
      tprFrequency: 'ANNUAL',
      tirReviewPeriodStart: '1900-04-01',
      tirReviewPeriodEnd: '1900-03-31',
      tirSubmission: '1900-04-30',
      tirReview: '1900-06-29',
      upcomingExamOrAuditYear: 2024,
      upcomingExamOrAuditType: 'Field Exam',
      tirFrequency: 'ANNUAL',
      tirSemiAnnualReviewPeriodStart: null,
      tirSemiAnnualReviewPeriodEnd: null,
      tirSemiAnnualSubmission: null,
      tirSemiAnnualReview: null,
      lastAuditFiscalYear: 2021,
      auditCompletionYear: 2021,
      auditCompletionStatus: 'NOT_CLOSED',
      tprCompletionYear: 2022,
      tprCompletionStatus: 'INCOMPLETE',
      tirCompletionYear: 2025,
      tirCompletionStatus: 'COMPLETE',
      lastMonthlyReportReceived: '2020-01-16',
      leaseExpiration: '2020-01-17',
      idExpiration: '2020-01-18',
      lastCompensationStudy: '2020-01-19',
      bondIssuedDate: '2020-01-20',
      bondRenewalDate: '2020-01-21',
      annualReportCompletionYear: null,
      annualReportCompletionStatus: null,
      ch13AuditCompletionYear: null,
      ch13AuditCompletionStatus: null,
      ch13TprCompletionYear: null,
      ch13TprCompletionStatus: null,
    });
  });

  test('computes and retains semi-annual submission/due values when tirFrequency is SEMI_ANNUAL', () => {
    const result = buildTrusteeInterimReportKeyDatesInput(
      { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
      fullOriginal,
      {
        tirFrequency: 'SEMI_ANNUAL',
        tirPeriodKey: '01/01-06/30 & 07/01-12/31',
        tirReviewPeriodStart: '1900-01-01',
        tirReviewPeriodEnd: '1900-06-30',
        tirSemiAnnualReviewPeriodStart: '1900-07-01',
        tirSemiAnnualReviewPeriodEnd: '1900-12-31',
        tirCompletionYear: 2025,
        tirCompletionStatus: 'COMPLETE',
        pastTprSubmission: '',
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        tirFrequency: 'SEMI_ANNUAL',
        tirReviewPeriodStart: '1900-01-01',
        tirReviewPeriodEnd: '1900-06-30',
        tirSubmission: '1900-07-30',
        tirReview: '1900-09-28',
        tirSemiAnnualReviewPeriodStart: '1900-07-01',
        tirSemiAnnualReviewPeriodEnd: '1900-12-31',
        tirSemiAnnualSubmission: '1900-01-30',
        tirSemiAnnualReview: '1900-03-30',
      }),
    );
  });

  test('defaults every field to null when there is no original document and the form is empty', () => {
    const result = buildTrusteeInterimReportKeyDatesInput(
      { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
      null,
      {
        tirFrequency: '',
        tirPeriodKey: '',
        tirReviewPeriodStart: '',
        tirReviewPeriodEnd: '',
        tirSemiAnnualReviewPeriodStart: '',
        tirSemiAnnualReviewPeriodEnd: '',
        tirCompletionYear: '',
        tirCompletionStatus: '',
        pastTprSubmission: '',
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
      annualReportCompletionYear: null,
      annualReportCompletionStatus: null,
      ch13AuditCompletionYear: null,
      ch13AuditCompletionStatus: null,
      ch13TprCompletionYear: null,
      ch13TprCompletionStatus: null,
    });
  });
});
