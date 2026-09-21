import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Chapter13StandingOtherForm from './Chapter13StandingOtherForm';
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
  leaseExpiration: '2027-06-30',
  pastBackgroundQuestion: '2025-01-15',
  idExpiration: '2028-01-15',
  lastCompensationStudy: '2024-06-01',
  pastAudit: '2025-06-30',
};

function renderComponent() {
  return render(
    <MemoryRouter
      initialEntries={[
        '/trustees/trustee-001/appointments/appointment-001/chapter13-standing-other-key-dates/edit',
      ]}
    >
      <GlobalAlertContext.Provider value={mockGlobalAlertRef}>
        <Routes>
          <Route
            path="/trustees/:trusteeId/appointments/:appointmentId/chapter13-standing-other-key-dates/edit"
            element={<Chapter13StandingOtherForm />}
          />
        </Routes>
      </GlobalAlertContext.Provider>
    </MemoryRouter>,
  );
}

describe('Chapter13StandingOtherForm', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
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
      expect(screen.getByTestId('lease-expiration')).toHaveValue('2027-06-30');
    });
    expect(screen.getByTestId('past-background-question')).toHaveValue('2025-01-15');
    expect(screen.getByTestId('id-expiration')).toHaveValue('2028-01-15');
    expect(screen.getByTestId('last-compensation-study-month')).toHaveValue('06');
    expect(screen.getByTestId('last-compensation-study-year')).toHaveValue('2024');
  });

  test('saves a merged input preserving fields this form does not edit', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: existingDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();
    await screen.findByTestId('lease-expiration');

    await userEvent.clear(screen.getByTestId('id-expiration'));
    await userEvent.type(screen.getByTestId('id-expiration'), '2029-02-01');

    await userEvent.click(screen.getByTestId('button-save-chapter13-standing-other-key-dates'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          leaseExpiration: '2027-06-30',
          pastBackgroundQuestion: '2025-01-15',
          idExpiration: '2029-02-01',
          lastCompensationStudy: '2024-06-01',
          pastAudit: '2025-06-30',
        }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });

  test('Cancel navigates back to the appointments list without saving', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: existingDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates');
    renderComponent();
    await screen.findByTestId('lease-expiration');

    await userEvent.click(screen.getByTestId('button-cancel-chapter13-standing-other-key-dates'));

    expect(putSpy).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });

  test('shows an error alert when load fails', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('network error'));

    renderComponent();

    await waitFor(() => {
      expect(mockGlobalAlertRef.current.error).toHaveBeenCalled();
    });
  });

  test('shows an error alert when save fails', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: existingDocument });
    vi.spyOn(Api2, 'putUpcomingKeyDates').mockRejectedValue(new Error('network error'));

    renderComponent();
    await screen.findByTestId('lease-expiration');

    await userEvent.click(screen.getByTestId('button-save-chapter13-standing-other-key-dates'));

    await waitFor(() => {
      expect(mockGlobalAlertRef.current.error).toHaveBeenCalled();
    });
  });
});
