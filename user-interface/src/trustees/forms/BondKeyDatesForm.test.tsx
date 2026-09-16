import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import BondKeyDatesForm from './BondKeyDatesForm';
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
  pastFieldExam: '2024-02-21',
  bondIssuedDate: '2023-06-01',
  bondRenewalDate: '2026-06-01',
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
        <BondKeyDatesForm />
      </GlobalAlertContext.Provider>
    </BrowserRouter>,
  );
}

describe('BondKeyDatesForm', () => {
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
      'You do not have permission to manage Trustee Bond Key Dates',
    );
  });

  test('shows loading spinner while fetching', () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockImplementation(() => new Promise(() => {}));

    renderComponent();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-bond-key-dates')).not.toBeInTheDocument();
  });

  test('pre-populates form from API response', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('bond-issued-date')).toHaveValue('2023-06-01');
    });
    expect(screen.getByTestId('bond-renewal-date')).toHaveValue('2026-06-01');
  });

  test('shows empty inputs when API returns null', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-bond-key-dates')).toBeInTheDocument();
    });
    expect(screen.getByTestId('bond-issued-date')).toHaveValue('');
    expect(screen.getByTestId('bond-renewal-date')).toHaveValue('');
  });

  test('save calls PUT with both bond dates while preserving other fields, then navigates', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('bond-issued-date')).toHaveValue('2023-06-01'));

    await userEvent.click(screen.getByTestId('button-save-bond-key-dates'));

    await waitFor(() => {
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          trusteeId: 'trustee-001',
          appointmentId: 'appointment-001',
          bondIssuedDate: '2023-06-01',
          bondRenewalDate: '2026-06-01',
          pastFieldExam: '2024-02-21',
        }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });

  test('shows inline error alert when bond key dates fail to load', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('Network error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-bond-key-dates')).toBeInTheDocument();
    });
    expect(mockGlobalAlertRef.current.error).toHaveBeenCalledWith(
      'Failed to load bond key dates: Network error',
    );
    expect(screen.getByTestId('bond-issued-date')).toHaveValue('');
    expect(screen.getByTestId('bond-renewal-date')).toHaveValue('');
  });

  test('shows error alert when save fails and re-enables save button', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    vi.spyOn(Api2, 'putUpcomingKeyDates').mockRejectedValue(new Error('Server error'));

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('bond-issued-date')).toHaveValue('2023-06-01'));

    await userEvent.click(screen.getByTestId('button-save-bond-key-dates'));

    await waitFor(() => {
      const saveButton = screen.getByTestId('button-save-bond-key-dates');
      expect(saveButton).not.toBeDisabled();
      expect(saveButton).toHaveTextContent('Save');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockGlobalAlertRef.current.error).toHaveBeenCalledWith(
      'Failed to save bond key dates: Server error',
    );
  });

  test('Save button is disabled when bond renewal date has an invalid date', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('bond-renewal-date')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('bond-renewal-date'), {
      target: { value: '1900-01-01' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('button-save-bond-key-dates')).toBeDisabled();
    });
  });

  test('cancel navigates back to the appointments page without saving', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('bond-issued-date')).toHaveValue('2023-06-01'));

    await userEvent.click(screen.getByTestId('button-cancel-bond-key-dates'));

    expect(putSpy).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });
});
