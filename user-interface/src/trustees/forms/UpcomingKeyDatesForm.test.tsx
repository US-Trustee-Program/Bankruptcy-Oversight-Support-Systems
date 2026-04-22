import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import UpcomingKeyDatesForm from './UpcomingKeyDatesForm';
import Api2 from '@/lib/models/api2';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

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

const currentYear = new Date().getFullYear();

const populatedDocument: TrusteeUpcomingKeyDates = {
  id: 'doc-001',
  documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
  trusteeId: 'trustee-001',
  appointmentId: 'appointment-001',
  createdBy: SYSTEM_USER_REFERENCE,
  createdOn: '2026-01-01T00:00:00.000Z',
  updatedBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2026-01-01T00:00:00.000Z',
  pastFieldExam: '2026-06-15',
  pastAudit: '2026-08-01',
  upcomingExamOrAuditYear: currentYear + 3,
  upcomingExamOrAuditType: 'Field Exam',
  tirFrequency: 'ANNUAL',
  tirReviewPeriodStart: '1900-07-01',
  tirReviewPeriodEnd: '1900-06-30',
  tirSubmission: '1900-07-30',
  tirReview: '1900-09-28',
  tprReviewPeriodStart: '1900-04-01',
  tprReviewPeriodEnd: '1900-03-31',
  tprDue: '1900-09-15',
  tprDueYearType: 'ODD',
  lastAuditFiscalYear: 2024,
};

function renderComponent() {
  return render(
    <BrowserRouter>
      <UpcomingKeyDatesForm />
    </BrowserRouter>,
  );
}

describe('UpcomingKeyDatesForm', () => {
  const mockNavigate = vi.fn();
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
    userEvent = TestingUtilities.setupUserEvent();
  });

  describe('rendering', () => {
    test('renders year dropdown and type dropdown', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-upcoming-key-dates')).toBeInTheDocument();
      });

      expect(screen.getByTestId('upcoming-exam-audit-year')).toBeInTheDocument();
      expect(screen.getByTestId('upcoming-exam-audit-type')).toBeInTheDocument();
    });

    test('renders frequency and period dropdowns', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-upcoming-key-dates')).toBeInTheDocument();
      });

      expect(screen.getByTestId('tir-frequency')).toBeInTheDocument();
      expect(screen.getByTestId('tir-period')).toBeInTheDocument();
    });

    test('does not render TIR Submission or TIR Review input fields', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-upcoming-key-dates')).toBeInTheDocument();
      });

      expect(document.getElementById('tir-submission-month')).not.toBeInTheDocument();
      expect(document.getElementById('tir-review-month')).not.toBeInTheDocument();
    });

    test('TPR labels show "Trustee Performance Review Period" and "Trustee Performance Review Due"', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-upcoming-key-dates')).toBeInTheDocument();
      });

      expect(screen.getByTestId('tpr-review-period-label')).toHaveTextContent(
        'Trustee Performance Review (TPR) Period',
      );
      expect(screen.getByText('Trustee Performance Review (TPR) Due')).toBeInTheDocument();
    });

    test('year dropdown shows current year through current year + 10', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upcoming-exam-audit-year')).toBeInTheDocument();
      });

      const select = screen.getByTestId('upcoming-exam-audit-year') as HTMLSelectElement;
      const options = Array.from(select.options)
        .map((o) => o.value)
        .filter((v) => v !== '');
      expect(options).toHaveLength(11);
      expect(options[0]).toBe(String(currentYear));
      expect(options[10]).toBe(String(currentYear + 10));
    });

    test('type dropdown has "Field Exam" and "Audit" options', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upcoming-exam-audit-type')).toBeInTheDocument();
      });

      const select = screen.getByTestId('upcoming-exam-audit-type') as HTMLSelectElement;
      const values = Array.from(select.options)
        .map((o) => o.value)
        .filter((v) => v !== '');
      expect(values).toContain('Field Exam');
      expect(values).toContain('Audit');
    });

    test('frequency dropdown has "Annual" and "Semi-Annual" options', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('tir-frequency')).toBeInTheDocument();
      });

      expect(screen.getByRole('option', { name: 'Annual' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Semi-Annual' })).toBeInTheDocument();
    });

    test('period dropdown shows 4 options when Annual is selected', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('tir-frequency')).toBeInTheDocument();
      });

      await userEvent.selectOptions(screen.getByTestId('tir-frequency'), 'ANNUAL');

      const select = screen.getByTestId('tir-period') as HTMLSelectElement;
      const options = Array.from(select.options).filter((o) => o.value !== '');
      expect(options).toHaveLength(4);
    });

    test('period dropdown shows 4 pair options when Semi-Annual is selected', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('tir-frequency')).toBeInTheDocument();
      });

      await userEvent.selectOptions(screen.getByTestId('tir-frequency'), 'SEMI_ANNUAL');

      const select = screen.getByTestId('tir-period') as HTMLSelectElement;
      const options = Array.from(select.options).filter((o) => o.value !== '');
      expect(options).toHaveLength(4);
      expect(options[0].value).toContain('&');
    });

    test('changing frequency clears period selection', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('tir-frequency')).toBeInTheDocument();
      });

      await userEvent.selectOptions(screen.getByTestId('tir-frequency'), 'ANNUAL');
      await userEvent.selectOptions(screen.getByTestId('tir-period'), '07/01-06/30');

      expect(screen.getByTestId('tir-period')).toHaveValue('07/01-06/30');

      await userEvent.selectOptions(screen.getByTestId('tir-frequency'), 'SEMI_ANNUAL');

      expect(screen.getByTestId('tir-period')).toHaveValue('');
    });

    test('shows loading spinner while fetching and hides form', () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockImplementation(() => new Promise(() => {}));

      renderComponent();

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-upcoming-key-dates')).not.toBeInTheDocument();
    });
  });

  describe('loading initial data', () => {
    test('pre-populates year, type, frequency, and period from API response', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upcoming-exam-audit-year')).toHaveValue(String(currentYear + 3));
      });

      expect(screen.getByTestId('upcoming-exam-audit-type')).toHaveValue('Field Exam');
      expect(screen.getByTestId('tir-frequency')).toHaveValue('ANNUAL');
      expect(screen.getByTestId('tir-period')).toHaveValue('07/01-06/30');
    });

    test('shows empty selects when API returns null', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-upcoming-key-dates')).toBeInTheDocument();
      });

      expect(screen.getByTestId('upcoming-exam-audit-year')).toHaveValue('');
      expect(screen.getByTestId('upcoming-exam-audit-type')).toHaveValue('');
      expect(screen.getByTestId('tir-frequency')).toHaveValue('');
    });
  });

  describe('saving', () => {
    test('save with Annual period: tirSubmission and tirReview calculated; tirSubmission2 and tirReview2 null', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('tir-frequency')).toBeInTheDocument();
      });

      await userEvent.selectOptions(screen.getByTestId('tir-frequency'), 'ANNUAL');
      await userEvent.selectOptions(screen.getByTestId('tir-period'), '07/01-06/30');
      await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

      await waitFor(() => expect(putSpy).toHaveBeenCalled());
      const payload = putSpy.mock.calls[0][2];
      // tirReviewPeriodEnd = 1900-06-30; submission = +30 = 1900-07-30; review = +60 = 1900-09-28
      expect(payload.tirSubmission).toBe('1900-07-30');
      expect(payload.tirReview).toBe('1900-09-28');
      expect(payload.tirSubmission2).toBeNull();
      expect(payload.tirReview2).toBeNull();
      expect(payload.tirReviewPeriodStart2).toBeNull();
      expect(payload.tirReviewPeriodEnd2).toBeNull();
    });

    test('save with Semi-Annual period: all four TIR dates calculated correctly', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('tir-frequency')).toBeInTheDocument();
      });

      await userEvent.selectOptions(screen.getByTestId('tir-frequency'), 'SEMI_ANNUAL');
      await userEvent.selectOptions(screen.getByTestId('tir-period'), '01/01-06/30 & 07/01-12/31');
      await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

      await waitFor(() => expect(putSpy).toHaveBeenCalled());
      const payload = putSpy.mock.calls[0][2];
      // period1 end = 1900-06-30; sub1 = +30 = 1900-07-30; rev1 = +60 = 1900-09-28
      expect(payload.tirSubmission).toBe('1900-07-30');
      expect(payload.tirReview).toBe('1900-09-28');
      // period2 end = 1900-12-31; sub2 = +30 = 1900-01-30
      // rev2 = 1900-01-30 + 60 days; arithmetic uses year 2000 (leap year: Feb has 29 days)
      // Jan 30 + 60: Jan=1, Feb=29, Mar=30 → 1900-03-30
      expect(payload.tirSubmission2).toBe('1900-01-30');
      expect(payload.tirReview2).toBe('1900-03-30');
    });

    test('lastAuditFiscalYear is preserved in PUT payload', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upcoming-exam-audit-year')).toHaveValue(String(currentYear + 3));
      });

      await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

      await waitFor(() => expect(putSpy).toHaveBeenCalled());
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({ lastAuditFiscalYear: 2024 }),
      );
    });

    test('upcomingExamOrAuditYear and upcomingExamOrAuditType saved in PUT payload', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upcoming-exam-audit-year')).toBeInTheDocument();
      });

      await userEvent.selectOptions(
        screen.getByTestId('upcoming-exam-audit-year'),
        String(currentYear + 2),
      );
      await userEvent.selectOptions(screen.getByTestId('upcoming-exam-audit-type'), 'Audit');
      await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

      await waitFor(() => expect(putSpy).toHaveBeenCalled());
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          upcomingExamOrAuditYear: currentYear + 2,
          upcomingExamOrAuditType: 'Audit',
        }),
      );
    });

    test('saves selected Year Type in PUT payload', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('tpr-due-year-type')).toBeInTheDocument();
      });

      await userEvent.selectOptions(document.getElementById('tpr-due-month')!, '09');
      await userEvent.selectOptions(document.getElementById('tpr-due-day')!, '15');
      await userEvent.selectOptions(screen.getByTestId('tpr-due-year-type'), 'EVEN');
      await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

      await waitFor(() => expect(putSpy).toHaveBeenCalled());
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({ tprDue: '1900-09-15', tprDueYearType: 'EVEN' }),
      );
    });

    test('save preserves past date fields from API response', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upcoming-exam-audit-year')).toHaveValue(String(currentYear + 3));
      });

      await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

      await waitFor(() => expect(putSpy).toHaveBeenCalled());
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          pastFieldExam: '2026-06-15',
          pastAudit: '2026-08-01',
        }),
      );
    });

    test('shows error alert when save fails and re-enables save button', async () => {
      mockNavigate.mockClear();
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
      vi.spyOn(Api2, 'putUpcomingKeyDates').mockRejectedValue(new Error('Server error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-upcoming-key-dates')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

      await waitFor(() => {
        const saveButton = screen.getByTestId('button-save-upcoming-key-dates');
        expect(saveButton).not.toBeDisabled();
        expect(saveButton).toHaveTextContent('Save');
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('Cancel navigates without calling PUT', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-upcoming-key-dates')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('button-cancel-upcoming-key-dates'));

      expect(putSpy).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
    });
  });

  describe('TPR Review Period validation', () => {
    test('shows error and blocks save when review period start is set without end', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-upcoming-key-dates')).toBeInTheDocument();
      });

      await userEvent.selectOptions(
        document.getElementById('tpr-review-period-start-month')!,
        '04',
      );
      await userEvent.selectOptions(document.getElementById('tpr-review-period-start-day')!, '01');
      await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

      expect(screen.getByTestId('tpr-review-period-error')).toBeInTheDocument();
      expect(putSpy).not.toHaveBeenCalled();
    });

    test('shows error and blocks save when review period end is set without start', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-upcoming-key-dates')).toBeInTheDocument();
      });

      await userEvent.selectOptions(document.getElementById('tpr-review-period-end-month')!, '03');
      await userEvent.selectOptions(document.getElementById('tpr-review-period-end-day')!, '31');
      await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

      expect(screen.getByTestId('tpr-review-period-error')).toBeInTheDocument();
      expect(putSpy).not.toHaveBeenCalled();
    });
  });

  describe('TPR Due validation', () => {
    test('highlights Year Type field when date is complete but Year Type not set', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-upcoming-key-dates')).toBeInTheDocument();
      });

      await userEvent.selectOptions(document.getElementById('tpr-due-month')!, '09');
      await userEvent.selectOptions(document.getElementById('tpr-due-day')!, '15');
      await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

      expect(screen.getByTestId('tpr-due-year-type')).toHaveClass('usa-input--error');
      expect(screen.getByTestId('tpr-due-error')).toHaveTextContent(
        'TPR Due Year Type is required.',
      );
      expect(putSpy).not.toHaveBeenCalled();
    });

    test('clears errors when user selects Year Type', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-upcoming-key-dates')).toBeInTheDocument();
      });

      await userEvent.selectOptions(document.getElementById('tpr-due-month')!, '09');
      await userEvent.selectOptions(document.getElementById('tpr-due-day')!, '15');
      await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

      expect(screen.getByTestId('tpr-due-error')).toHaveTextContent(
        'TPR Due Year Type is required.',
      );

      await userEvent.selectOptions(screen.getByTestId('tpr-due-year-type'), 'EVEN');

      expect(screen.queryByTestId('tpr-due-error')).not.toBeInTheDocument();
    });

    test('clear button saves null for both tprDue and tprDueYearType', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('button-tpr-due-clear')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('button-tpr-due-clear'));
      await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

      await waitFor(() => expect(putSpy).toHaveBeenCalled());
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({ tprDue: null, tprDueYearType: null }),
      );
    });
  });
});
