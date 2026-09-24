import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Chapter7PanelTrusteePerformanceReportForm, {
  buildTrusteePerformanceReportKeyDatesInput,
} from './Chapter7PanelTrusteePerformanceReportForm';
import Api2 from '@/lib/models/api2';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { CamsRole } from '@common/cams/roles';
import { GlobalAlertContext } from '@/App';
import useFeatureFlags, { TPR_DISPLAY_UPDATES } from '@/lib/hooks/UseFeatureFlags';
import { testFeatureFlags } from '@common/feature-flags';

vi.mock('@/lib/hooks/UseFeatureFlags');
const mockUseFeatureFlags = vi.mocked(useFeatureFlags);

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
  tprReviewPeriodStart: '2026-04-01',
  tprReviewPeriodEnd: '2027-03-31',
  tprFrequency: 'ANNUAL',
  tprDue: '1900-10-06',
  tprDueYearType: 'EVEN',
  lastTprSubmitted: '2025-10-03',
  tprCompletionYear: 2025,
  tprCompletionStatus: 'COMPLETE',
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
        <Chapter7PanelTrusteePerformanceReportForm />
      </GlobalAlertContext.Provider>
    </BrowserRouter>,
  );
}

describe('Chapter7PanelTrusteePerformanceReportForm', () => {
  const mockNavigate = vi.fn();
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    mockGlobalAlertRef.current.error.mockClear();
    mockUseNavigate.mockReturnValue(mockNavigate);
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
    userEvent = TestingUtilities.setupUserEvent();
    mockUseFeatureFlags.mockReturnValue(testFeatureFlags);
  });

  test('shows forbidden message when user lacks TrusteeAdmin role', async () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    const forbiddenAlert = await screen.findByTestId('alert-forbidden-alert');
    expect(forbiddenAlert).toBeInTheDocument();
    expect(forbiddenAlert).toHaveTextContent('Forbidden');
    expect(forbiddenAlert).toHaveTextContent(
      'You do not have permission to manage Trustee Performance Report Key Dates',
    );
  });

  test('shows loading spinner while fetching', () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockImplementation(() => new Promise(() => {}));

    renderComponent();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-chapter7-panel-tpr')).not.toBeInTheDocument();
  });

  test('pre-populates form from API response', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tpr-review-period-start')).toHaveValue('2026-04-01');
    });
    expect(screen.getByTestId('tpr-review-period-end')).toHaveValue('2027-03-31');
    expect(screen.getByTestId('tpr-frequency')).toHaveValue('ANNUAL');
    expect(screen.getByTestId('tpr-due-year-type')).toHaveValue('EVEN');
    expect(screen.getByTestId('last-tpr-submitted')).toHaveValue('2025-10-03');
    expect(screen.getByTestId('tpr-completion-status-year')).toHaveValue('2025');
    expect(screen.getByTestId('tpr-completion-status-status')).toHaveValue('COMPLETE');
  });

  test('shows empty inputs when API returns null', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-chapter7-panel-tpr')).toBeInTheDocument();
    });
    expect(screen.getByTestId('tpr-review-period-start')).toHaveValue('');
    expect(screen.getByTestId('tpr-review-period-end')).toHaveValue('');
    expect(screen.getByTestId('tpr-frequency')).toHaveValue('');
    expect(screen.getByTestId('tpr-due-year-type')).toHaveValue('');
    expect(screen.getByTestId('last-tpr-submitted')).toHaveValue('');
    expect(screen.getByTestId('tpr-completion-status-year')).toHaveValue('');
    expect(screen.getByTestId('tpr-completion-status-status')).toHaveValue('');
  });

  test('save calls PUT with all owned fields while preserving other fields, then navigates', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('tpr-review-period-start')).toHaveValue('2026-04-01'),
    );

    await userEvent.click(screen.getByTestId('button-save-chapter7-panel-tpr'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          trusteeId: 'trustee-001',
          appointmentId: 'appointment-001',
          tprReviewPeriodStart: '2026-04-01',
          tprReviewPeriodEnd: '2027-03-31',
          tprFrequency: 'ANNUAL',
          tprDue: '1900-10-06',
          tprDueYearType: 'EVEN',
          lastTprSubmitted: '2025-10-03',
          tprCompletionYear: 2025,
          tprCompletionStatus: 'COMPLETE',
        }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });

  test('changing the select fields updates form state and is captured in the save payload', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('tpr-review-period-start')).toHaveValue('2026-04-01'),
    );

    await userEvent.selectOptions(screen.getByTestId('tpr-frequency'), 'SEMI_ANNUAL');
    await userEvent.selectOptions(screen.getByTestId('tpr-due-year-type'), 'ODD');
    await userEvent.selectOptions(screen.getByTestId('tpr-completion-status-year'), '2024');
    await userEvent.selectOptions(screen.getByTestId('tpr-completion-status-status'), 'INCOMPLETE');

    expect(screen.getByTestId('tpr-frequency')).toHaveValue('SEMI_ANNUAL');
    expect(screen.getByTestId('tpr-due-year-type')).toHaveValue('ODD');
    expect(screen.getByTestId('tpr-completion-status-year')).toHaveValue('2024');
    expect(screen.getByTestId('tpr-completion-status-status')).toHaveValue('INCOMPLETE');

    await userEvent.click(screen.getByTestId('button-save-chapter7-panel-tpr'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          tprFrequency: 'SEMI_ANNUAL',
          tprDueYearType: 'ODD',
          tprCompletionYear: 2024,
          tprCompletionStatus: 'INCOMPLETE',
        }),
      );
    });
  });

  test('resetting both completion status fields back to blank clears them from the save payload', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('tpr-completion-status-year')).toHaveValue('2025'),
    );

    await userEvent.selectOptions(screen.getByTestId('tpr-completion-status-year'), '');
    await userEvent.selectOptions(screen.getByTestId('tpr-completion-status-status'), '');

    await userEvent.click(screen.getByTestId('button-save-chapter7-panel-tpr'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({ tprCompletionYear: null, tprCompletionStatus: null }),
      );
    });
  });

  test('Save button is disabled and shows a message when only the completion status year is cleared', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('tpr-completion-status-year')).toHaveValue('2025'),
    );

    await userEvent.selectOptions(screen.getByTestId('tpr-completion-status-year'), '');

    expect(screen.queryByTestId('tpr-completion-status-error')).not.toBeInTheDocument();

    fireEvent.blur(screen.getByTestId('tpr-completion-status-year'), { relatedTarget: null });

    await waitFor(() => {
      expect(screen.getByTestId('tpr-completion-status-error')).toHaveTextContent(
        'Trustee Performance Review Completion Status Year and Status must both be set.',
      );
      expect(screen.getByTestId('button-save-chapter7-panel-tpr')).toBeDisabled();
    });
  });

  test('Save button is disabled and shows a message when only the completion status status is cleared', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('tpr-completion-status-status')).toHaveValue('COMPLETE'),
    );

    await userEvent.selectOptions(screen.getByTestId('tpr-completion-status-status'), '');

    expect(screen.queryByTestId('tpr-completion-status-error')).not.toBeInTheDocument();

    fireEvent.blur(screen.getByTestId('tpr-completion-status-status'), { relatedTarget: null });

    await waitFor(() => {
      expect(screen.getByTestId('tpr-completion-status-error')).toHaveTextContent(
        'Trustee Performance Review Completion Status Year and Status must both be set.',
      );
      expect(screen.getByTestId('button-save-chapter7-panel-tpr')).toBeDisabled();
    });
  });

  test('shows inline error alert when key dates fail to load', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('Network error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-chapter7-panel-tpr')).toBeInTheDocument();
    });
    expect(mockGlobalAlertRef.current.error).toHaveBeenCalledWith(
      'Failed to load Trustee Performance Report key dates: Network error',
    );
  });

  test('disables Save when key dates fail to load, so a save cannot null out the shared document', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('Network error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('button-save-chapter7-panel-tpr')).toBeDisabled();
    });
  });

  test('shows error alert when save fails and re-enables save button', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    vi.spyOn(Api2, 'putUpcomingKeyDates').mockRejectedValue(new Error('Server error'));

    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('tpr-review-period-start')).toHaveValue('2026-04-01'),
    );

    await userEvent.click(screen.getByTestId('button-save-chapter7-panel-tpr'));

    await waitFor(() => {
      const saveButton = screen.getByTestId('button-save-chapter7-panel-tpr');
      expect(saveButton).not.toBeDisabled();
      expect(saveButton).toHaveTextContent('Save');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockGlobalAlertRef.current.error).toHaveBeenCalledWith(
      'Failed to save Trustee Performance Report key dates: Server error',
    );
  });

  test.each([
    ['last-tpr-submitted', 'Last TPR Submitted'],
    ['tpr-review-period-start', 'TPR Period Start'],
    ['tpr-review-period-end', 'TPR Period End'],
  ])('Save button is disabled when %s has an invalid date', async (testId) => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId(testId), {
      target: { value: '1900-01-01' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('button-save-chapter7-panel-tpr')).toBeDisabled();
    });
  });

  test('Save button is disabled when TPR Review Period is out of order', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('tpr-review-period-start')).toHaveValue('2026-04-01'),
    );

    fireEvent.change(screen.getByTestId('tpr-review-period-start'), {
      target: { value: '2027-04-01' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('button-save-chapter7-panel-tpr')).toBeDisabled();
    });
  });

  test('Save button is disabled and shows a message when TPR Due is set without a Year Type', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('tpr-due-year-type')).toHaveValue('EVEN'));

    await userEvent.selectOptions(screen.getByTestId('tpr-due-year-type'), '');

    expect(screen.queryByTestId('tpr-due-error')).not.toBeInTheDocument();

    fireEvent.blur(screen.getByTestId('tpr-due-year-type'), { relatedTarget: null });

    await waitFor(() => {
      expect(screen.getByTestId('tpr-due-error')).toHaveTextContent(
        'TPR Due Year Type is required.',
      );
      expect(screen.getByTestId('button-save-chapter7-panel-tpr')).toBeDisabled();
    });
  });

  test('Save button is disabled and shows a message when TPR Due is cleared while a Year Type remains set', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('tpr-due-year-type')).toHaveValue('EVEN'));

    fireEvent.focus(document.getElementById('tpr-due-month')!);
    fireEvent.change(document.getElementById('tpr-due-month')!, { target: { value: '' } });
    fireEvent.blur(document.getElementById('tpr-due-month')!, { relatedTarget: null });

    await waitFor(() => {
      expect(screen.getByTestId('tpr-due-error')).toBeInTheDocument();
      expect(screen.getByTestId('button-save-chapter7-panel-tpr')).toBeDisabled();
    });
  });

  test('Save button is disabled and shows a message when TPR Due Year Type is set without a TPR Due date', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-chapter7-panel-tpr')).toBeInTheDocument();
    });

    await userEvent.selectOptions(screen.getByTestId('tpr-due-year-type'), 'EVEN');

    expect(screen.queryByTestId('tpr-due-error')).not.toBeInTheDocument();

    fireEvent.blur(screen.getByTestId('tpr-due-year-type'), { relatedTarget: null });

    await waitFor(() => {
      expect(screen.getByTestId('tpr-due-error')).toBeInTheDocument();
      expect(screen.getByTestId('button-save-chapter7-panel-tpr')).toBeDisabled();
    });
  });

  test('cancel navigates back to the appointments page without saving', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() =>
      expect(screen.getByTestId('tpr-review-period-start')).toHaveValue('2026-04-01'),
    );

    await userEvent.click(screen.getByTestId('button-cancel-chapter7-panel-tpr'));

    expect(putSpy).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });

  describe('TPR Review Period pair validation', () => {
    test('shows error and blocks save when review period start is set without end', async () => {
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-chapter7-panel-tpr')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('tpr-review-period-start'), {
        target: { value: '2025-04-01' },
      });
      await userEvent.click(screen.getByTestId('button-save-chapter7-panel-tpr'));

      await waitFor(() => {
        expect(screen.getByText('TPR Review Period End is required.')).toBeInTheDocument();
      });
      expect(putSpy).not.toHaveBeenCalled();
    });

    test('shows error and blocks save when review period end is set without start', async () => {
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-chapter7-panel-tpr')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('tpr-review-period-end'), {
        target: { value: '2026-03-31' },
      });
      await userEvent.click(screen.getByTestId('button-save-chapter7-panel-tpr'));

      await waitFor(() => {
        expect(screen.getByText('TPR Review Period Start is required.')).toBeInTheDocument();
      });
      expect(putSpy).not.toHaveBeenCalled();
    });

    test('clears required error on end field when user focuses it', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-chapter7-panel-tpr')).toBeInTheDocument();
      });

      const startInput = screen.getByTestId('tpr-review-period-start');
      const endInput = screen.getByTestId('tpr-review-period-end');

      fireEvent.change(startInput, { target: { value: '2025-04-01' } });
      await userEvent.click(screen.getByTestId('button-save-chapter7-panel-tpr'));

      await waitFor(() => {
        expect(screen.getByText('TPR Review Period End is required.')).toBeInTheDocument();
      });

      fireEvent.focus(endInput);

      await waitFor(() => {
        expect(screen.queryByText('TPR Review Period End is required.')).not.toBeInTheDocument();
      });
    });

    test('clears required error on start field when user focuses it', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-chapter7-panel-tpr')).toBeInTheDocument();
      });

      const startInput = screen.getByTestId('tpr-review-period-start');
      const endInput = screen.getByTestId('tpr-review-period-end');

      fireEvent.change(endInput, { target: { value: '2026-03-31' } });
      await userEvent.click(screen.getByTestId('button-save-chapter7-panel-tpr'));

      await waitFor(() => {
        expect(screen.getByText('TPR Review Period Start is required.')).toBeInTheDocument();
      });

      fireEvent.focus(startInput);

      await waitFor(() => {
        expect(screen.queryByText('TPR Review Period Start is required.')).not.toBeInTheDocument();
      });
    });

    test('shows chronological errors on both fields when focus leaves the group with start after end', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-chapter7-panel-tpr')).toBeInTheDocument();
      });

      const startInput = screen.getByTestId('tpr-review-period-start');
      const endInput = screen.getByTestId('tpr-review-period-end');

      fireEvent.change(startInput, { target: { value: '2026-12-31' } });
      fireEvent.change(endInput, { target: { value: '2025-01-01' } });
      fireEvent.blur(endInput, { relatedTarget: null });

      await waitFor(() => {
        expect(document.getElementById('tpr-review-period-start-error')).toHaveTextContent(
          'TPR Review Period Start must be before TPR Review Period End.',
        );
        expect(document.getElementById('tpr-review-period-end-error')).toHaveTextContent(
          'TPR Review Period End must be after TPR Review Period Start.',
        );
      });
    });

    test('clears chronological errors on both fields when start date is corrected', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-chapter7-panel-tpr')).toBeInTheDocument();
      });

      const startInput = screen.getByTestId('tpr-review-period-start');
      const endInput = screen.getByTestId('tpr-review-period-end');

      fireEvent.change(startInput, { target: { value: '2026-12-31' } });
      fireEvent.change(endInput, { target: { value: '2025-01-01' } });
      fireEvent.blur(endInput, { relatedTarget: null });

      await waitFor(() => {
        expect(document.getElementById('tpr-review-period-end-error')).toHaveTextContent(
          'TPR Review Period End must be after TPR Review Period Start.',
        );
      });

      fireEvent.change(startInput, { target: { value: '2024-01-01' } });

      await waitFor(() => {
        expect(
          screen.queryByText('TPR Review Period Start must be before TPR Review Period End.'),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText('TPR Review Period End must be after TPR Review Period Start.'),
        ).not.toBeInTheDocument();
      });
    });

    test('clears chronological errors on both fields when end date is corrected', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-chapter7-panel-tpr')).toBeInTheDocument();
      });

      const startInput = screen.getByTestId('tpr-review-period-start');
      const endInput = screen.getByTestId('tpr-review-period-end');

      fireEvent.change(startInput, { target: { value: '2026-12-31' } });
      fireEvent.change(endInput, { target: { value: '2025-01-01' } });
      fireEvent.blur(endInput, { relatedTarget: null });

      await waitFor(() => {
        expect(document.getElementById('tpr-review-period-end-error')).toHaveTextContent(
          'TPR Review Period End must be after TPR Review Period Start.',
        );
      });

      fireEvent.change(endInput, { target: { value: '2027-01-01' } });

      await waitFor(() => {
        expect(
          screen.queryByText('TPR Review Period Start must be before TPR Review Period End.'),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText('TPR Review Period End must be after TPR Review Period Start.'),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('when TPR_DISPLAY_UPDATES flag is off', () => {
    beforeEach(() => {
      mockUseFeatureFlags.mockReturnValue({ ...testFeatureFlags, [TPR_DISPLAY_UPDATES]: false });
    });

    test('shows MonthDayRangeSelector for period and hides DatePickers and frequency select', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-chapter7-panel-tpr')).toBeInTheDocument();
      });
      expect(screen.getByTestId('tpr-review-period-label')).toBeInTheDocument();
      expect(screen.queryByTestId('tpr-review-period-start')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tpr-review-period-end')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tpr-frequency')).not.toBeInTheDocument();
    });

    test('Save button is disabled when the MonthDayRangeSelector reports an invalid (incomplete) period', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-chapter7-panel-tpr')).toBeInTheDocument();
      });
      expect(screen.getByTestId('button-save-chapter7-panel-tpr')).not.toBeDisabled();

      fireEvent.change(document.getElementById('tpr-review-period-end-month')!, {
        target: { value: '' },
      });
      fireEvent.change(document.getElementById('tpr-review-period-end-day')!, {
        target: { value: '' },
      });

      await waitFor(() => {
        expect(screen.getByTestId('button-save-chapter7-panel-tpr')).toBeDisabled();
      });
    });

    test('save converts period fields to sentinel format and preserves tprFrequency', async () => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
      const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('edit-chapter7-panel-tpr')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('button-save-chapter7-panel-tpr'));

      await waitFor(() => {
        expect(putSpy).toHaveBeenCalledWith(
          'trustee-001',
          'appointment-001',
          expect.objectContaining({
            tprReviewPeriodStart: '1900-04-01',
            tprReviewPeriodEnd: '1900-03-31',
            tprFrequency: 'ANNUAL',
          }),
        );
      });
    });
  });
});

describe('buildTrusteePerformanceReportKeyDatesInput', () => {
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
    const result = buildTrusteePerformanceReportKeyDatesInput(
      { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
      fullOriginal,
      {
        tprReviewPeriodStart: '2026-04-01',
        tprReviewPeriodEnd: '2027-03-31',
        tprFrequency: 'SEMI_ANNUAL',
        tprDue: '1900-10-06',
        tprDueYearType: 'ODD',
        lastTprSubmitted: '2025-10-03',
        tprCompletionYear: 2025,
        tprCompletionStatus: 'COMPLETE',
      },
    );

    expect(result).toEqual({
      trusteeId: 'trustee-001',
      appointmentId: 'appointment-001',
      pastBackgroundQuestion: '2020-01-01',
      pastFieldExam: '2020-01-02',
      pastAudit: '2020-01-03',
      pastTprSubmission: '2020-01-04',
      lastTprSubmitted: '2025-10-03',
      tprReviewPeriodStart: '2026-04-01',
      tprReviewPeriodEnd: '2027-03-31',
      tprDue: '1900-10-06',
      tprDueYearType: 'ODD',
      tprFrequency: 'SEMI_ANNUAL',
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
      tprCompletionYear: 2025,
      tprCompletionStatus: 'COMPLETE',
      tirCompletionYear: 2023,
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

  test('defaults every field to null when there is no original document and the form is empty', () => {
    const result = buildTrusteePerformanceReportKeyDatesInput(
      { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
      null,
      {
        tprReviewPeriodStart: '',
        tprReviewPeriodEnd: '',
        tprFrequency: '',
        tprDue: '',
        tprDueYearType: '',
        lastTprSubmitted: '',
        tprCompletionYear: '',
        tprCompletionStatus: '',
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

  test('converts period fields to sentinel format when tprDisplayUpdates is false', () => {
    const result = buildTrusteePerformanceReportKeyDatesInput(
      { trusteeId: 'trustee-001', appointmentId: 'appointment-001' },
      null,
      {
        tprReviewPeriodStart: '2026-04-01',
        tprReviewPeriodEnd: '2027-03-31',
        tprFrequency: 'ANNUAL',
        tprDue: '',
        tprDueYearType: '',
        lastTprSubmitted: '',
        tprCompletionYear: '',
        tprCompletionStatus: '',
      },
      false,
    );

    expect(result.tprReviewPeriodStart).toBe('1900-04-01');
    expect(result.tprReviewPeriodEnd).toBe('1900-03-31');
  });
});
