import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Chapter13StandingTrusteePerformanceReportForm from './Chapter13StandingTrusteePerformanceReportForm';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { GlobalAlertContext } from '@/App';

const mockUseNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: mockUseNavigate,
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

const existingDocument: TrusteeUpcomingKeyDates = {
  id: 'doc-001',
  documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
  trusteeId: 'trustee-001',
  appointmentId: 'appointment-001',
  createdBy: SYSTEM_USER_REFERENCE,
  createdOn: '2026-01-01T00:00:00.000Z',
  updatedBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2026-01-01T00:00:00.000Z',
  tprReviewPeriodStart: '2025-04-01',
  tprReviewPeriodEnd: '2025-09-30',
  tprFrequency: 'ANNUAL',
  tprDue: '1900-09-15',
  tprDueYearType: 'EVEN',
  pastTprSubmission: '2025-10-01',
  leaseExpiration: '2027-06-30',
};

function renderComponent() {
  return render(
    <MemoryRouter
      initialEntries={[
        '/trustees/trustee-001/appointments/appointment-001/chapter13-standing-tpr-key-dates/edit',
      ]}
    >
      <GlobalAlertContext.Provider value={mockGlobalAlertRef}>
        <Routes>
          <Route
            path="/trustees/:trusteeId/appointments/:appointmentId/chapter13-standing-tpr-key-dates/edit"
            element={<Chapter13StandingTrusteePerformanceReportForm />}
          />
        </Routes>
      </GlobalAlertContext.Provider>
    </MemoryRouter>,
  );
}

describe('Chapter13StandingTrusteePerformanceReportForm', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
    mockGlobalAlertRef.current.error.mockClear();
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
  });

  test('shows a permission-denied Stop when user cannot manage trustees', async () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('alert-container-forbidden-alert')).toBeInTheDocument();
    });
  });

  test('pre-populates fields from the existing document', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: existingDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tpr-review-period-start')).toHaveValue('2025-04-01');
    });
    expect(screen.getByTestId('tpr-review-period-end')).toHaveValue('2025-09-30');
    expect(screen.getByTestId('tpr-frequency')).toHaveValue('ANNUAL');
    expect(screen.getByTestId('last-tpr-submitted')).toHaveValue('2025-10-01');
  });

  test('Save button is disabled when only completion year is set', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: existingDocument });
    renderComponent();
    await screen.findByTestId('tpr-review-period-start');

    await userEvent.selectOptions(screen.getByTestId('tpr-completion-year'), '2026');

    expect(screen.getByTestId('button-save-chapter13-standing-tpr-key-dates')).toBeDisabled();
  });

  test('Save button is enabled when both completion fields are set, and saves a merged input preserving other fields', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: existingDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();
    await screen.findByTestId('tpr-review-period-start');

    await userEvent.selectOptions(screen.getByTestId('tpr-completion-year'), '2026');
    await userEvent.selectOptions(screen.getByTestId('tpr-completion-status'), 'Complete');

    const saveButton = screen.getByTestId('button-save-chapter13-standing-tpr-key-dates');
    expect(saveButton).not.toBeDisabled();
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          tprReviewPeriodStart: '2025-04-01',
          tprReviewPeriodEnd: '2025-09-30',
          tprFrequency: 'ANNUAL',
          tprDue: '1900-09-15',
          tprDueYearType: 'EVEN',
          pastTprSubmission: '2025-10-01',
          tprCompletionYear: 2026,
          tprCompletionStatus: 'Complete',
          leaseExpiration: '2027-06-30',
        }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });

  test('Cancel navigates back to the appointments list without saving', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: existingDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates');
    renderComponent();
    await screen.findByTestId('tpr-review-period-start');

    await userEvent.click(screen.getByTestId('button-cancel-chapter13-standing-tpr-key-dates'));

    expect(putSpy).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });
});
