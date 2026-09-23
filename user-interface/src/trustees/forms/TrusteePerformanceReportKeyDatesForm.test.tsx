import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import TrusteePerformanceReportKeyDatesForm from './TrusteePerformanceReportKeyDatesForm';
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

describe('TrusteePerformanceReportKeyDatesForm', () => {
  const mockNavigate = vi.fn();
  let userEvent: CamsUserEvent;
  const currentYear = new Date().getFullYear();

  const storedDocument: TrusteeUpcomingKeyDates = {
    id: 'doc-001',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-001',
    appointmentId: 'appointment-001',
    createdBy: SYSTEM_USER_REFERENCE,
    createdOn: '2026-01-01T00:00:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2026-01-01T00:00:00.000Z',
    tprReviewPeriodStart: '1900-04-01',
    tprReviewPeriodEnd: '1900-03-31',
    tprFrequency: 'ANNUAL',
    tprDue: '1900-09-15',
    tprDueYearType: 'EVEN',
    lastTprSubmitted: '2025-09-10',
    tprCompletionYear: currentYear - 1,
    tprCompletionStatus: 'INCOMPLETE',
    // Owned by the Annual Report card; saving here must not disturb it.
    annualReportCompletionYear: currentYear,
    annualReportCompletionStatus: 'COMPLETE',
    pastAudit: '2025-06-30',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    mockGlobalAlertRef.current.error.mockClear();
    mockUseNavigate.mockReturnValue(mockNavigate);
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
    userEvent = TestingUtilities.setupUserEvent();
  });

  function renderForm() {
    return render(
      <BrowserRouter>
        <GlobalAlertContext.Provider value={mockGlobalAlertRef}>
          <TrusteePerformanceReportKeyDatesForm />
        </GlobalAlertContext.Provider>
      </BrowserRouter>,
    );
  }

  test('shows forbidden message when the user lacks the TrusteeAdmin role', async () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderForm();

    expect(await screen.findByTestId('alert-forbidden-alert')).toHaveTextContent('Forbidden');
  });

  test('pre-populates every editable field from the stored document', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: storedDocument });

    renderForm();

    await waitFor(() => {
      expect(screen.getByTestId('tpr-frequency')).toHaveValue('ANNUAL');
    });
    expect(screen.getByTestId('tpr-due-year-type')).toHaveValue('EVEN');
    expect(screen.getByTestId('tpr-completion-year')).toHaveValue(String(currentYear - 1));
    expect(screen.getByTestId('tpr-completion-status')).toHaveValue('INCOMPLETE');
  });

  test('offers the three frequency options', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderForm();

    await waitFor(() => {
      expect(screen.getByTestId('tpr-frequency')).toBeInTheDocument();
    });
    const select = screen.getByTestId('tpr-frequency') as HTMLSelectElement;
    const values = Array.from(select.options)
      .map((o) => o.value)
      .filter((v) => v !== '');
    expect(values).toEqual(['SEMI_ANNUAL', 'ANNUAL', 'BIANNUAL']);
  });

  test('saves edits and preserves fields owned by the Annual Report card', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: storedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderForm();

    await waitFor(() => {
      expect(screen.getByTestId('tpr-frequency')).toBeInTheDocument();
    });

    await userEvent.selectOptions(screen.getByTestId('tpr-frequency'), 'BIANNUAL');
    await userEvent.selectOptions(screen.getByTestId('tpr-completion-status'), 'COMPLETE');
    await userEvent.click(screen.getByTestId('button-save-tpr-key-dates'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          tprFrequency: 'BIANNUAL',
          tprCompletionYear: currentYear - 1,
          tprCompletionStatus: 'COMPLETE',
          annualReportCompletionYear: currentYear,
          annualReportCompletionStatus: 'COMPLETE',
          pastAudit: '2025-06-30',
        }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });

  test('rejects a completion status without a year and does not save', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderForm();

    await waitFor(() => {
      expect(screen.getByTestId('tpr-completion-status')).toBeInTheDocument();
    });

    await userEvent.selectOptions(screen.getByTestId('tpr-completion-status'), 'COMPLETE');

    // Shown inline as the pair is edited, with Save disabled, matching the
    // Chapter 7 Panel forms.
    expect(await screen.findByTestId('tpr-completion-error')).toHaveTextContent(
      'Trustee Performance Review Completion Status Year and Status must both be set.',
    );
    expect(screen.getByTestId('button-save-tpr-key-dates')).toBeDisabled();
    expect(putSpy).not.toHaveBeenCalled();
  });

  // The API validates the whole document and rejects it; the message reaches the
  // user through the global alert, as it does on the Chapter 7 Panel forms.
  test('surfaces an API rejection of the merged document', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({
      data: { ...storedDocument, tprDueYearType: undefined },
    });
    vi.spyOn(Api2, 'putUpcomingKeyDates').mockRejectedValue(
      new Error('TPR Due Year Type is required.'),
    );

    renderForm();

    await waitFor(() => expect(screen.getByTestId('tpr-due-year-type')).toHaveValue(''));
    await userEvent.click(screen.getByTestId('button-save-tpr-key-dates'));

    await waitFor(() => {
      expect(mockGlobalAlertRef.current.error).toHaveBeenCalledWith(
        expect.stringMatching(/TPR Due Year Type is required/),
      );
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('returns to the appointments list on cancel without saving', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: storedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderForm();

    await waitFor(() => {
      expect(screen.getByTestId('button-cancel-tpr-key-dates')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId('button-cancel-tpr-key-dates'));

    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
    expect(putSpy).not.toHaveBeenCalled();
  });

  test('surfaces a load failure through the global alert', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('Network error'));

    renderForm();

    await waitFor(() => {
      expect(mockGlobalAlertRef.current.error).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to load trustee performance report key dates/),
      );
    });
  });

  test('surfaces a save failure through the global alert and stays on the page', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: storedDocument });
    vi.spyOn(Api2, 'putUpcomingKeyDates').mockRejectedValue(new Error('Save boom'));

    renderForm();

    await waitFor(() => {
      expect(screen.getByTestId('button-save-tpr-key-dates')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId('button-save-tpr-key-dates'));

    await waitFor(() => {
      expect(mockGlobalAlertRef.current.error).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to save trustee performance report key dates/),
      );
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // saveDisabled has three disjuncts; collapsing it to `isSaving` alone used to
  // leave every test in this file passing.
  describe('Save button disabling', () => {
    test('disables Save when the review period is left incomplete', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: storedDocument });

      renderForm();

      await waitFor(() => {
        expect(screen.getByTestId('button-save-tpr-key-dates')).not.toBeDisabled();
      });

      // Clearing the day leaves a month with no day, which is incomplete.
      fireEvent.change(document.getElementById('tpr-review-period-start-day')!, {
        target: { value: '' },
      });

      await waitFor(() => {
        expect(screen.getByTestId('button-save-tpr-key-dates')).toBeDisabled();
      });
    });

    test('disables Save when Last TPR Submitted holds an invalid date', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: storedDocument });

      renderForm();

      await waitFor(() => {
        expect(screen.getByTestId('button-save-tpr-key-dates')).not.toBeDisabled();
      });

      fireEvent.change(screen.getByTestId('last-tpr-submitted'), {
        target: { value: '1900-01-01' },
      });

      await waitFor(() => {
        expect(screen.getByTestId('button-save-tpr-key-dates')).toBeDisabled();
      });
    });
  });

  // This form used to surface a foreign field's message verbatim, so the user
  // saw a specific-looking error naming a control that is not on screen.
  test('saves even when another section of the document is invalid', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({
      data: {
        ...storedDocument,
        annualReportCompletionYear: 2025,
        annualReportCompletionStatus: undefined,
      },
    });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderForm();

    expect(await screen.findByTestId('tpr-frequency')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('button-save-tpr-key-dates'));

    await waitFor(() => expect(putSpy).toHaveBeenCalled());
  });
});
