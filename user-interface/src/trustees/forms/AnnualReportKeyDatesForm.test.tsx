import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import AnnualReportKeyDatesForm from './AnnualReportKeyDatesForm';
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

describe('AnnualReportKeyDatesForm', () => {
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
    annualReportCompletionYear: currentYear - 1,
    annualReportCompletionStatus: 'INCOMPLETE',
    // Owned by other cards; saving here must not disturb them.
    tprCompletionYear: currentYear,
    tprCompletionStatus: 'COMPLETE',
    tprReviewPeriodStart: '1900-04-01',
    tprReviewPeriodEnd: '1900-03-31',
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
          <AnnualReportKeyDatesForm />
        </GlobalAlertContext.Provider>
      </BrowserRouter>,
    );
  }

  test('shows forbidden message when the user lacks the TrusteeAdmin role', async () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderForm();

    const alert = await screen.findByTestId('alert-forbidden-alert');
    expect(alert).toHaveTextContent('Forbidden');
  });

  test('pre-populates the dropdowns from the stored document', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: storedDocument });

    renderForm();

    await waitFor(() => {
      expect(screen.getByTestId('annual-report-completion-year')).toHaveValue(
        String(currentYear - 1),
      );
    });
    expect(screen.getByTestId('annual-report-completion-status')).toHaveValue('INCOMPLETE');
  });

  test('offers the current year and the ten years before it', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderForm();

    await waitFor(() => {
      expect(screen.getByTestId('annual-report-completion-year')).toBeInTheDocument();
    });
    const select = screen.getByTestId('annual-report-completion-year') as HTMLSelectElement;
    const values = Array.from(select.options)
      .map((o) => o.value)
      .filter((v) => v !== '');
    expect(values).toHaveLength(11);
    expect(values[0]).toBe(String(currentYear));
    expect(values[10]).toBe(String(currentYear - 10));
  });

  test('offers only Complete and Incomplete as statuses', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderForm();

    await waitFor(() => {
      expect(screen.getByTestId('annual-report-completion-status')).toBeInTheDocument();
    });
    const select = screen.getByTestId('annual-report-completion-status') as HTMLSelectElement;
    const values = Array.from(select.options)
      .map((o) => o.value)
      .filter((v) => v !== '');
    expect(values).toEqual(['COMPLETE', 'INCOMPLETE']);
  });

  test('saves the edited pair and preserves fields owned by other cards', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: storedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderForm();

    await waitFor(() => {
      expect(screen.getByTestId('annual-report-completion-year')).toBeInTheDocument();
    });

    await userEvent.selectOptions(
      screen.getByTestId('annual-report-completion-year'),
      String(currentYear),
    );
    await userEvent.selectOptions(
      screen.getByTestId('annual-report-completion-status'),
      'COMPLETE',
    );
    await userEvent.click(screen.getByTestId('button-save-annual-report-key-dates'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          annualReportCompletionYear: currentYear,
          annualReportCompletionStatus: 'COMPLETE',
          tprCompletionYear: currentYear,
          tprCompletionStatus: 'COMPLETE',
          tprReviewPeriodStart: '1900-04-01',
          pastAudit: '2025-06-30',
        }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });

  test('rejects a year without a status and does not save', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderForm();

    await waitFor(() => {
      expect(screen.getByTestId('annual-report-completion-year')).toBeInTheDocument();
    });

    await userEvent.selectOptions(
      screen.getByTestId('annual-report-completion-year'),
      String(currentYear),
    );
    await userEvent.click(screen.getByTestId('button-save-annual-report-key-dates'));

    expect(await screen.findByTestId('alert-annual-report-completion-error')).toHaveTextContent(
      'Annual Report Completion Status is required.',
    );
    expect(putSpy).not.toHaveBeenCalled();
  });

  test('rejects a status without a year and does not save', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderForm();

    await waitFor(() => {
      expect(screen.getByTestId('annual-report-completion-status')).toBeInTheDocument();
    });

    await userEvent.selectOptions(
      screen.getByTestId('annual-report-completion-status'),
      'COMPLETE',
    );
    await userEvent.click(screen.getByTestId('button-save-annual-report-key-dates'));

    expect(await screen.findByTestId('alert-annual-report-completion-error')).toHaveTextContent(
      'Annual Report Completion Status Year is required.',
    );
    expect(putSpy).not.toHaveBeenCalled();
  });

  test('allows clearing both halves of the pair', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: storedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderForm();

    await waitFor(() => {
      expect(screen.getByTestId('annual-report-completion-year')).toBeInTheDocument();
    });

    await userEvent.selectOptions(screen.getByTestId('annual-report-completion-year'), '');
    await userEvent.selectOptions(screen.getByTestId('annual-report-completion-status'), '');
    await userEvent.click(screen.getByTestId('button-save-annual-report-key-dates'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          annualReportCompletionYear: null,
          annualReportCompletionStatus: null,
        }),
      );
    });
  });

  test('returns to the appointments list on cancel without saving', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: storedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderForm();

    await waitFor(() => {
      expect(screen.getByTestId('button-cancel-annual-report-key-dates')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId('button-cancel-annual-report-key-dates'));

    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
    expect(putSpy).not.toHaveBeenCalled();
  });

  test('surfaces a load failure through the global alert', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('Network error'));

    renderForm();

    await waitFor(() => {
      expect(mockGlobalAlertRef.current.error).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to load annual report key dates/),
      );
    });
  });

  test('surfaces a save failure through the global alert and stays on the page', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: storedDocument });
    vi.spyOn(Api2, 'putUpcomingKeyDates').mockRejectedValue(new Error('Save boom'));

    renderForm();

    await waitFor(() => {
      expect(screen.getByTestId('button-save-annual-report-key-dates')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTestId('button-save-annual-report-key-dates'));

    await waitFor(() => {
      expect(mockGlobalAlertRef.current.error).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to save annual report key dates/),
      );
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
