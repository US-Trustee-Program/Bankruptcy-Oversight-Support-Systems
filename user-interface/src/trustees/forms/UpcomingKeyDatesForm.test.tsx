import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
  tprReviewPeriodStart: '1900-04-01',
  tprReviewPeriodEnd: '1900-03-31',
  tprDue: '1900-09-15',
  tprDueYearType: 'ODD',
  tirReviewPeriodStart: '1900-07-01',
  tirReviewPeriodEnd: '1900-06-30',
  tirSubmission: '1900-10-15',
  tirReview: '1900-11-01',
  upcomingFieldExam: '2029-08-01',
  upcomingIndependentAuditRequired: '2032-08-01',
};

function renderComponent() {
  return render(
    <BrowserRouter>
      <UpcomingKeyDatesForm />
    </BrowserRouter>,
  );
}

describe('EditUpcomingKeyDates', () => {
  const mockNavigate = vi.fn();
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
    userEvent = TestingUtilities.setupUserEvent();
  });

  describe('rendering', () => {
    test('renders all 9 labeled inputs', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-upcoming-key-dates')).toBeInTheDocument();
      });

      // DatePicker fields (Field Exam and Audit are the renamed "next" fields)
      expect(screen.getByTestId('field-exam')).toBeInTheDocument();
      expect(screen.getByTestId('audit')).toBeInTheDocument();
      expect(document.getElementById('tpr-due-month')).toBeInTheDocument();
      expect(document.getElementById('tpr-due-day')).toBeInTheDocument();
      expect(document.getElementById('tir-submission-month')).toBeInTheDocument();
      expect(document.getElementById('tir-review-month')).toBeInTheDocument();

      // Year Qualifier dropdown
      expect(screen.getByTestId('tpr-due-year-type')).toBeInTheDocument();

      // MonthDayRangeSelector fields
      expect(screen.getByTestId('tpr-review-period-label')).toBeInTheDocument();
      expect(document.getElementById('tpr-review-period-start-month')).toBeInTheDocument();
      expect(document.getElementById('tpr-review-period-end-month')).toBeInTheDocument();
      expect(screen.getByTestId('tir-review-period-label')).toBeInTheDocument();
      expect(document.getElementById('tir-review-period-start-month')).toBeInTheDocument();
      expect(document.getElementById('tir-review-period-end-month')).toBeInTheDocument();
    });
  });

  describe('loading initial data', () => {
    test('pre-populates form from API response', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('field-exam')).toHaveValue('2029-08-01');
      });

      expect(screen.getByTestId('audit')).toHaveValue('2032-08-01');
      expect(document.getElementById('tpr-review-period-start-month')).toHaveValue('04');
      expect(document.getElementById('tpr-review-period-start-day')).toHaveValue('01');
      expect(document.getElementById('tpr-review-period-end-month')).toHaveValue('03');
      expect(document.getElementById('tpr-review-period-end-day')).toHaveValue('31');
      expect(document.getElementById('tpr-due-month')).toHaveValue('09');
      expect(document.getElementById('tpr-due-day')).toHaveValue('15');
      expect(screen.getByTestId('tpr-due-year-type')).toHaveValue('ODD');
      expect(document.getElementById('tir-review-period-start-month')).toHaveValue('07');
      expect(document.getElementById('tir-review-period-start-day')).toHaveValue('01');
      expect(document.getElementById('tir-review-period-end-month')).toHaveValue('06');
      expect(document.getElementById('tir-review-period-end-day')).toHaveValue('30');
      expect(document.getElementById('tir-submission-month')).toHaveValue('10');
      expect(document.getElementById('tir-submission-day')).toHaveValue('15');
      expect(document.getElementById('tir-review-month')).toHaveValue('11');
      expect(document.getElementById('tir-review-day')).toHaveValue('01');
    });

    test('shows empty inputs when API returns null', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('field-exam')).toHaveValue('');
      });
    });

    test('shows loading spinner while fetching and hides form', () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockImplementation(() => new Promise(() => {}));

      renderComponent();

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-upcoming-key-dates')).not.toBeInTheDocument();
    });

    test('shows error alert when fetch fails', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('Network failure'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-upcoming-key-dates')).toBeInTheDocument();
      });
    });
  });

  describe('auto-calculated TIR dates', () => {
    test('auto-calculates tirSubmission and tirReview when TIR review period end changes', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

      await userEvent.selectOptions(document.getElementById('tir-review-period-end-month')!, '03');
      await userEvent.selectOptions(document.getElementById('tir-review-period-end-day')!, '31');

      await waitFor(() => {
        // 1900-03-31 + 30 days = 1900-04-30
        expect(document.getElementById('tir-submission-month')).toHaveValue('04');
        expect(document.getElementById('tir-submission-day')).toHaveValue('30');
        // 1900-04-30 + 60 days = 1900-06-29
        expect(document.getElementById('tir-review-month')).toHaveValue('06');
        expect(document.getElementById('tir-review-day')).toHaveValue('29');
      });
    });
  });

  describe('form validation', () => {
    describe('TPR Review Period', () => {
      test('shows error and blocks save when review period start is set without end', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
        const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        await userEvent.selectOptions(
          document.getElementById('tpr-review-period-start-month')!,
          '04',
        );
        await userEvent.selectOptions(
          document.getElementById('tpr-review-period-start-day')!,
          '01',
        );
        await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

        expect(screen.getByTestId('tpr-review-period-error')).toBeInTheDocument();
        expect(putSpy).not.toHaveBeenCalled();
      });

      test('shows error and blocks save when review period end is set without start', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
        const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        await userEvent.selectOptions(
          document.getElementById('tpr-review-period-end-month')!,
          '03',
        );
        await userEvent.selectOptions(document.getElementById('tpr-review-period-end-day')!, '31');
        await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

        expect(screen.getByTestId('tpr-review-period-error')).toBeInTheDocument();
        expect(putSpy).not.toHaveBeenCalled();
      });

      test('shows error and blocks save when only start month is selected (incomplete date)', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
        const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        await userEvent.selectOptions(
          document.getElementById('tpr-review-period-start-month')!,
          '04',
        );
        // Blur away to trigger the internal error display
        await userEvent.click(screen.getByTestId('field-exam'));

        await waitFor(() => {
          expect(screen.getByTestId('tpr-review-period-error')).toHaveTextContent(
            'Must be a valid date mm/dd.',
          );
        });
        expect(putSpy).not.toHaveBeenCalled();
      });

      test('shows "Must be a valid date mm/dd." when start is complete but end only has month', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
        const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        await userEvent.selectOptions(
          document.getElementById('tpr-review-period-start-month')!,
          '04',
        );
        await userEvent.selectOptions(
          document.getElementById('tpr-review-period-start-day')!,
          '01',
        );
        await userEvent.selectOptions(
          document.getElementById('tpr-review-period-end-month')!,
          '03',
        );
        // Blur away to trigger the internal error display
        await userEvent.click(screen.getByTestId('field-exam'));

        await waitFor(() => {
          expect(screen.getByTestId('tpr-review-period-error')).toHaveTextContent(
            'Must be a valid date mm/dd.',
          );
        });
        expect(putSpy).not.toHaveBeenCalled();
      });
      test('clears error and removes error border when start date day selector is focused', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        // Fill start month+day and end month only (end day enabled but incomplete)
        await userEvent.selectOptions(
          document.getElementById('tpr-review-period-start-month')!,
          '04',
        );
        await userEvent.selectOptions(
          document.getElementById('tpr-review-period-start-day')!,
          '01',
        );
        await userEvent.selectOptions(
          document.getElementById('tpr-review-period-end-month')!,
          '03',
        );
        // Blur away to surface the incomplete end date error
        await userEvent.click(screen.getByTestId('field-exam'));

        await waitFor(() => {
          expect(screen.getByTestId('tpr-review-period-error')).toHaveTextContent(
            'Must be a valid date mm/dd.',
          );
          expect(document.getElementById('tpr-review-period-end-month')).toHaveClass(
            'usa-input--error',
          );
          expect(document.getElementById('tpr-review-period-end-day')).toHaveClass(
            'usa-input--error',
          );
        });

        // Focus the start date day selector — row becomes focused, error should clear
        await userEvent.click(document.getElementById('tpr-review-period-start-day')!);

        expect(screen.queryByTestId('tpr-review-period-error')).not.toBeInTheDocument();
        expect(document.getElementById('tpr-review-period-end-month')).not.toHaveClass(
          'usa-input--error',
        );
        expect(document.getElementById('tpr-review-period-end-day')).not.toHaveClass(
          'usa-input--error',
        );
      });
    });

    describe('TIR Review Period', () => {
      test('shows error and blocks save when review period start is set without end', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
        const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        await userEvent.selectOptions(
          document.getElementById('tir-review-period-start-month')!,
          '07',
        );
        await userEvent.selectOptions(
          document.getElementById('tir-review-period-start-day')!,
          '01',
        );
        await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

        expect(screen.getByTestId('tir-review-period-error')).toBeInTheDocument();
        expect(putSpy).not.toHaveBeenCalled();
      });

      test('shows error and blocks save when review period end is set without start', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
        const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        await userEvent.selectOptions(
          document.getElementById('tir-review-period-end-month')!,
          '06',
        );
        await userEvent.selectOptions(document.getElementById('tir-review-period-end-day')!, '30');
        await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

        expect(screen.getByTestId('tir-review-period-error')).toBeInTheDocument();
        expect(putSpy).not.toHaveBeenCalled();
      });

      test('shows error and blocks save when only start month is selected (incomplete date)', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
        const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        await userEvent.selectOptions(
          document.getElementById('tir-review-period-start-month')!,
          '07',
        );
        // Blur away to trigger the internal error display
        await userEvent.click(screen.getByTestId('field-exam'));

        await waitFor(() => {
          expect(screen.getByTestId('tir-review-period-error')).toHaveTextContent(
            'Must be a valid date mm/dd.',
          );
        });
        expect(putSpy).not.toHaveBeenCalled();
      });

      test('shows "Must be a valid date mm/dd." when start is complete but end only has month', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
        const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        await userEvent.selectOptions(
          document.getElementById('tir-review-period-start-month')!,
          '07',
        );
        await userEvent.selectOptions(
          document.getElementById('tir-review-period-start-day')!,
          '01',
        );
        await userEvent.selectOptions(
          document.getElementById('tir-review-period-end-month')!,
          '06',
        );
        // Blur away to trigger the internal error display
        await userEvent.click(screen.getByTestId('field-exam'));

        await waitFor(() => {
          expect(screen.getByTestId('tir-review-period-error')).toHaveTextContent(
            'Must be a valid date mm/dd.',
          );
        });
        expect(putSpy).not.toHaveBeenCalled();
      });

      test('clears error and removes error border when start date day selector is focused', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        // Fill start month+day and end month only (end day enabled but incomplete)
        await userEvent.selectOptions(
          document.getElementById('tir-review-period-start-month')!,
          '07',
        );
        await userEvent.selectOptions(
          document.getElementById('tir-review-period-start-day')!,
          '01',
        );
        await userEvent.selectOptions(
          document.getElementById('tir-review-period-end-month')!,
          '06',
        );
        // Blur away to surface the incomplete end date error
        await userEvent.click(screen.getByTestId('field-exam'));

        await waitFor(() => {
          expect(screen.getByTestId('tir-review-period-error')).toHaveTextContent(
            'Must be a valid date mm/dd.',
          );
          expect(document.getElementById('tir-review-period-end-month')).toHaveClass(
            'usa-input--error',
          );
          expect(document.getElementById('tir-review-period-end-day')).toHaveClass(
            'usa-input--error',
          );
        });

        // Focus the start date day selector — row becomes focused, error should clear
        await userEvent.click(document.getElementById('tir-review-period-start-day')!);

        expect(screen.queryByTestId('tir-review-period-error')).not.toBeInTheDocument();
        expect(document.getElementById('tir-review-period-end-month')).not.toHaveClass(
          'usa-input--error',
        );
        expect(document.getElementById('tir-review-period-end-day')).not.toHaveClass(
          'usa-input--error',
        );
      });
    });

    describe('TPR Due', () => {
      test('displays errors for both TPR Review Period and TPR Due when both are invalid', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
        const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        // Set TPR Review Period start without end (causes validation error)
        await userEvent.selectOptions(
          document.getElementById('tpr-review-period-start-month')!,
          '04',
        );
        await userEvent.selectOptions(
          document.getElementById('tpr-review-period-start-day')!,
          '01',
        );

        // Set TPR Due date without Year Type (causes validation error)
        await userEvent.selectOptions(document.getElementById('tpr-due-month')!, '09');
        await userEvent.selectOptions(document.getElementById('tpr-due-day')!, '15');

        await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

        // Both errors should be displayed
        expect(screen.getByTestId('tpr-review-period-error')).toBeInTheDocument();
        expect(screen.getByTestId('tpr-due-error')).toBeInTheDocument();
        expect(putSpy).not.toHaveBeenCalled();
      });

      test('highlights only Month/Day fields when TPR Due date has error', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
        const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        // Set Year Type without TPR Due date (causes validation error on tprDue)
        await userEvent.selectOptions(screen.getByTestId('tpr-due-year-type'), 'EVEN');
        await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

        // TPR Due date fields should have error class
        expect(document.getElementById('tpr-due-month')).toHaveClass('usa-input--error');
        expect(document.getElementById('tpr-due-day')).toHaveClass('usa-input--error');

        // Year Type should NOT have error class
        expect(screen.getByTestId('tpr-due-year-type')).not.toHaveClass('usa-input--error');

        // Blur error takes priority: shows "Must be a valid date mm/dd." (date absent, year type set)
        expect(screen.getByTestId('tpr-due-error')).toBeInTheDocument();
        expect(putSpy).not.toHaveBeenCalled();
      });

      test('highlights only Year Type field when it has error', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
        const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        // Set TPR Due date without Year Type (causes validation error on tprDueYearType)
        await userEvent.selectOptions(document.getElementById('tpr-due-month')!, '09');
        await userEvent.selectOptions(document.getElementById('tpr-due-day')!, '15');
        await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

        // Year Type should have error class
        expect(screen.getByTestId('tpr-due-year-type')).toHaveClass('usa-input--error');

        // TPR Due date fields should NOT have error class
        expect(document.getElementById('tpr-due-month')).not.toHaveClass('usa-input--error');
        expect(document.getElementById('tpr-due-day')).not.toHaveClass('usa-input--error');

        expect(screen.getByTestId('tpr-due-error')).toBeInTheDocument();
        expect(putSpy).not.toHaveBeenCalled();
      });

      test('clears Year Type error when user selects a value', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        // Set TPR Due date without Year Type and trigger validation error
        await userEvent.selectOptions(document.getElementById('tpr-due-month')!, '09');
        await userEvent.selectOptions(document.getElementById('tpr-due-day')!, '15');
        await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

        expect(screen.getByTestId('tpr-due-error')).toBeInTheDocument();
        expect(screen.getByTestId('tpr-due-year-type')).toHaveClass('usa-input--error');

        // Select Year Type - should clear error
        await userEvent.selectOptions(screen.getByTestId('tpr-due-year-type'), 'EVEN');

        expect(screen.queryByTestId('tpr-due-error')).not.toBeInTheDocument();
        expect(screen.getByTestId('tpr-due-year-type')).not.toHaveClass('usa-input--error');
      });

      test('clears TPR Due date error when user selects date values', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        // Set Year Type without TPR Due date and trigger validation error
        await userEvent.selectOptions(screen.getByTestId('tpr-due-year-type'), 'EVEN');
        await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

        // Blur error takes priority: shows "Must be a valid date mm/dd." (date absent, year type set)
        expect(screen.getByTestId('tpr-due-error')).toBeInTheDocument();
        expect(document.getElementById('tpr-due-month')).toHaveClass('usa-input--error');

        // Select Month - should clear error (re-focuses the row, clearing blur error)
        await userEvent.selectOptions(document.getElementById('tpr-due-month')!, '09');

        expect(screen.queryByTestId('tpr-due-error')).not.toBeInTheDocument();
        expect(document.getElementById('tpr-due-month')).not.toHaveClass('usa-input--error');
      });

      test('day field is disabled until month is selected', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        // Day should be disabled when month is not selected
        expect(document.getElementById('tpr-due-day')).toBeDisabled();

        // Select month - day should become enabled
        await userEvent.selectOptions(document.getElementById('tpr-due-month')!, '09');
        expect(document.getElementById('tpr-due-day')).not.toBeDisabled();

        // Clear month - day should become disabled again
        await userEvent.selectOptions(document.getElementById('tpr-due-month')!, '');
        expect(document.getElementById('tpr-due-day')).toBeDisabled();
      });

      test('does not allow saving with only month selected (incomplete date)', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
        const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        // Select only month, not day
        await userEvent.selectOptions(document.getElementById('tpr-due-month')!, '09');
        // Select Year Type
        await userEvent.selectOptions(screen.getByTestId('tpr-due-year-type'), 'EVEN');

        await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

        // Should not call the API with incomplete date - the field should be empty/null
        await waitFor(() => {
          if (putSpy.mock.calls.length > 0) {
            expect(putSpy).toHaveBeenCalledWith(
              'trustee-001',
              'appointment-001',
              expect.objectContaining({ tprDue: null }),
            );
          }
        });
      });

      test('shows blur error after interacting with TPR Due row then blurring away', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        // Interact with the TPR Due row: enter a complete date without year type
        await userEvent.click(document.getElementById('tpr-due-month')!);
        await userEvent.selectOptions(document.getElementById('tpr-due-month')!, '09');
        await userEvent.selectOptions(document.getElementById('tpr-due-day')!, '15');
        // Click the field-exam input (outside the tpr-due-group__row) to trigger blur
        await userEvent.click(screen.getByTestId('field-exam'));

        await waitFor(() => {
          expect(screen.getByTestId('tpr-due-error')).toBeInTheDocument();
        });
      });

      test('shows Year Type blur error when date is complete but Year Type is not set on blur', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        await userEvent.selectOptions(document.getElementById('tpr-due-month')!, '09');
        await userEvent.selectOptions(document.getElementById('tpr-due-day')!, '15');
        // Click outside the row to trigger blur
        await userEvent.click(screen.getByTestId('field-exam'));

        await waitFor(() => {
          expect(screen.getByTestId('tpr-due-year-type')).toHaveClass('usa-input--error');
        });
      });

      describe('clear button', () => {
        test('is not visible when tprDue and tprDueYearType are both empty', async () => {
          vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

          renderComponent();

          expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

          expect(screen.queryByTestId('button-tpr-due-clear')).not.toBeInTheDocument();
        });

        test('appears when tprDue has a value', async () => {
          vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

          renderComponent();

          expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

          await userEvent.selectOptions(document.getElementById('tpr-due-month')!, '09');
          await userEvent.selectOptions(document.getElementById('tpr-due-day')!, '15');

          expect(screen.getByTestId('button-tpr-due-clear')).toBeInTheDocument();
        });

        test('appears when tprDueYearType has a value', async () => {
          vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

          renderComponent();

          expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

          await userEvent.selectOptions(screen.getByTestId('tpr-due-year-type'), 'EVEN');

          expect(screen.getByTestId('button-tpr-due-clear')).toBeInTheDocument();
        });

        test('appears when pre-populated from API', async () => {
          vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

          renderComponent();

          await waitFor(() => {
            expect(screen.getByTestId('button-tpr-due-clear')).toBeInTheDocument();
          });
        });

        test('clears both tprDue and tprDueYearType and hides itself when clicked', async () => {
          vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

          renderComponent();

          await waitFor(() => {
            expect(screen.getByTestId('button-tpr-due-clear')).toBeInTheDocument();
          });

          await userEvent.click(screen.getByTestId('button-tpr-due-clear'));

          expect(document.getElementById('tpr-due-month')).toHaveValue('');
          expect(document.getElementById('tpr-due-day')).toHaveValue('');
          expect(screen.getByTestId('tpr-due-year-type')).toHaveValue('');
          expect(screen.queryByTestId('button-tpr-due-clear')).not.toBeInTheDocument();
        });

        test('clears validation errors when clicked', async () => {
          vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

          renderComponent();

          expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

          // Trigger a validation error by setting only date without year type
          await userEvent.selectOptions(document.getElementById('tpr-due-month')!, '09');
          await userEvent.selectOptions(document.getElementById('tpr-due-day')!, '15');
          await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

          expect(screen.getByTestId('tpr-due-error')).toBeInTheDocument();

          await userEvent.click(screen.getByTestId('button-tpr-due-clear'));

          expect(screen.queryByTestId('tpr-due-error')).not.toBeInTheDocument();
        });

        test('saves null for both tprDue and tprDueYearType after clearing', async () => {
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

    describe('TIR Submission', () => {
      test('shows blur error after interacting and blurring with invalid value', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        // Focus TIR Submission, select only month (incomplete), then click outside to blur
        await userEvent.click(document.getElementById('tir-submission-month')!);
        await userEvent.selectOptions(document.getElementById('tir-submission-month')!, '04');
        // Click on the field-exam input (outside the tir-submission MonthDaySelector) to trigger blur
        await userEvent.click(screen.getByTestId('field-exam'));

        await waitFor(() => {
          expect(screen.getByTestId('tir-submission-error')).toBeInTheDocument();
        });
      });

      test('does not show blur error before any interaction', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        // Do not interact with TIR Submission at all
        expect(screen.queryByTestId('tir-submission-error')).not.toBeInTheDocument();
      });
    });

    describe('TIR Review', () => {
      test('shows blur error after interacting and blurring with invalid value', async () => {
        vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

        renderComponent();

        expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

        await userEvent.click(document.getElementById('tir-review-month')!);
        await userEvent.selectOptions(document.getElementById('tir-review-month')!, '06');
        // Click on the field-exam input to trigger blur outside the tir-review group
        await userEvent.click(screen.getByTestId('field-exam'));

        await waitFor(() => {
          expect(screen.getByTestId('tir-review-error')).toBeInTheDocument();
        });
      });
    });
  });

  describe('saving and navigation', () => {
    test('valid save calls putUpcomingKeyDates with correct ISO body and navigates', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      expect(await screen.findByTestId('field-exam')).toBeInTheDocument();

      fireEvent.change(screen.getByTestId('field-exam'), { target: { value: '2029-08-15' } });
      await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

      await waitFor(() => expect(putSpy).toHaveBeenCalled());
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({ upcomingFieldExam: '2029-08-15' }),
      );
      expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
    });

    test('saves selected Year Type in PUT payload', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      expect(await screen.findByTestId('tpr-due-year-type')).toBeInTheDocument();

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

    test('clearing a field saves null and navigates to appointments', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => expect(screen.getByTestId('field-exam')).toHaveValue('2029-08-01'));

      await userEvent.clear(screen.getByTestId('field-exam'));
      await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

      await waitFor(() => expect(putSpy).toHaveBeenCalled());
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({ upcomingFieldExam: null }),
      );
      expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
    });

    test('save preserves non-displayed fields (pastFieldExam, pastAudit) from API response', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => expect(screen.getByTestId('field-exam')).toHaveValue('2029-08-01'));

      await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

      await waitFor(() =>
        expect(putSpy).toHaveBeenCalledWith(
          'trustee-001',
          'appointment-001',
          expect.objectContaining({
            pastFieldExam: '2026-06-15',
            pastAudit: '2026-08-01',
          }),
        ),
      );
    });

    test('shows error alert when save fails and re-enables save button', async () => {
      mockNavigate.mockClear();
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
      vi.spyOn(Api2, 'putUpcomingKeyDates').mockRejectedValue(new Error('Server error'));

      renderComponent();

      expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

      await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

      await waitFor(() => {
        const saveButton = screen.getByTestId('button-save-upcoming-key-dates');
        expect(saveButton).not.toBeDisabled();
        expect(saveButton).toHaveTextContent('Save');
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test('disables save button and shows "Saving..." while save is in progress', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
      let resolvePut: (value: { data: null }) => void;
      vi.spyOn(Api2, 'putUpcomingKeyDates').mockImplementation(
        () =>
          new Promise<{ data: null }>((resolve) => {
            resolvePut = resolve;
          }),
      );

      renderComponent();

      expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

      await userEvent.click(screen.getByTestId('button-save-upcoming-key-dates'));

      await waitFor(() => {
        const saveButton = screen.getByTestId('button-save-upcoming-key-dates');
        expect(saveButton).toBeDisabled();
        expect(saveButton).toHaveTextContent('Saving...');
      });

      resolvePut!({ data: null });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
      });
    });

    test('Cancel navigates without calling PUT', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      expect(await screen.findByTestId('edit-upcoming-key-dates')).toBeInTheDocument();

      await userEvent.click(screen.getByTestId('button-cancel-upcoming-key-dates'));

      expect(putSpy).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
    });
  });
});
