import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Chapter13StandingAuditForm from './Chapter13StandingAuditForm';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { GlobalAlertContext } from '@/App';

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

const mockUseNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: mockUseNavigate,
  };
});

const existingDocument: TrusteeUpcomingKeyDates = {
  id: 'doc-001',
  documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
  trusteeId: 'trustee-001',
  appointmentId: 'appointment-001',
  createdBy: SYSTEM_USER_REFERENCE,
  createdOn: '2026-01-01T00:00:00.000Z',
  updatedBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2026-01-01T00:00:00.000Z',
  pastAudit: '2025-06-30',
  leaseExpiration: '2027-06-30',
  tprFrequency: 'ANNUAL',
};

function renderComponent() {
  return render(
    <MemoryRouter
      initialEntries={[
        '/trustees/trustee-001/appointments/appointment-001/chapter13-standing-audit-key-dates/edit',
      ]}
    >
      <GlobalAlertContext.Provider value={mockGlobalAlertRef}>
        <Routes>
          <Route
            path="/trustees/:trusteeId/appointments/:appointmentId/chapter13-standing-audit-key-dates/edit"
            element={<Chapter13StandingAuditForm />}
          />
        </Routes>
      </GlobalAlertContext.Provider>
    </MemoryRouter>,
  );
}

describe('Chapter13StandingAuditForm', () => {
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
      expect(screen.getByTestId('past-audit')).toHaveValue('2025-06-30');
    });
  });

  test('Save button is disabled when only completion year is set', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: existingDocument });
    renderComponent();

    await screen.findByTestId('past-audit');

    await userEvent.selectOptions(screen.getByTestId('audit-completion-year'), '2026');

    expect(screen.getByTestId('button-save-chapter13-standing-audit-key-dates')).toBeDisabled();
  });

  test('Save button is disabled when only completion status is set', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: existingDocument });
    renderComponent();

    await screen.findByTestId('past-audit');

    await userEvent.selectOptions(screen.getByTestId('audit-completion-status'), 'Complete');

    expect(screen.getByTestId('button-save-chapter13-standing-audit-key-dates')).toBeDisabled();
  });

  test('Save button is enabled when both completion fields are set, and saves a merged input preserving other fields', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: existingDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await screen.findByTestId('past-audit');

    await userEvent.selectOptions(screen.getByTestId('audit-completion-year'), '2026');
    await userEvent.selectOptions(screen.getByTestId('audit-completion-status'), 'Complete');

    const saveButton = screen.getByTestId('button-save-chapter13-standing-audit-key-dates');
    expect(saveButton).not.toBeDisabled();
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          pastAudit: '2025-06-30',
          auditCompletionYear: 2026,
          auditCompletionStatus: 'Complete',
          leaseExpiration: '2027-06-30',
          tprFrequency: 'ANNUAL',
        }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });

  test('Cancel navigates back to the appointments list without saving', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: existingDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates');
    renderComponent();

    await screen.findByTestId('past-audit');

    await userEvent.click(screen.getByTestId('button-cancel-chapter13-standing-audit-key-dates'));

    expect(putSpy).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });

  test('shows an error alert when save fails', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: existingDocument });
    vi.spyOn(Api2, 'putUpcomingKeyDates').mockRejectedValue(new Error('network error'));

    renderComponent();
    await screen.findByTestId('past-audit');

    await userEvent.selectOptions(screen.getByTestId('audit-completion-year'), '2026');
    await userEvent.selectOptions(screen.getByTestId('audit-completion-status'), 'Complete');
    await userEvent.click(screen.getByTestId('button-save-chapter13-standing-audit-key-dates'));

    await waitFor(() => {
      expect(mockGlobalAlertRef.current.error).toHaveBeenCalled();
    });
  });
});
