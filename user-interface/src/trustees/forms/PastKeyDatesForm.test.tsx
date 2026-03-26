import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import PastKeyDatesForm from './PastKeyDatesForm';
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
  pastFieldExam: '2024-02-21',
  pastAudit: '2023-08-01',
  tprReviewPeriodStart: '1900-04-01',
  tprReviewPeriodEnd: '1900-03-31',
  tprDue: '1900-09-15',
  tprDueYearType: 'EVEN',
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
      <PastKeyDatesForm />
    </BrowserRouter>,
  );
}

describe('PastKeyDatesForm', () => {
  const mockNavigate = vi.fn();
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    mockUseNavigate.mockReturnValue(mockNavigate);
    userEvent = TestingUtilities.setupUserEvent();
  });

  test('renders Field Exam and Audit inputs', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-past-key-dates')).toBeInTheDocument();
    });

    expect(screen.getByTestId('past-field-exam')).toBeInTheDocument();
    expect(screen.getByTestId('past-audit')).toBeInTheDocument();
  });

  test('pre-populates form from API response', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('past-field-exam')).toHaveValue('2024-02-21');
    });

    expect(screen.getByTestId('past-audit')).toHaveValue('2023-08-01');
  });

  test('shows empty inputs when API returns null', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('past-field-exam')).toHaveValue('');
    });

    expect(screen.getByTestId('past-audit')).toHaveValue('');
  });

  test('shows loading spinner while fetching', () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockImplementation(() => new Promise(() => {}));

    renderComponent();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-past-key-dates')).not.toBeInTheDocument();
  });

  test('save calls PUT with full payload preserving all fields and navigates', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('past-field-exam')).toHaveValue('2024-02-21'));

    await userEvent.click(screen.getByTestId('button-save-past-key-dates'));

    await waitFor(() =>
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          pastFieldExam: '2024-02-21',
          pastAudit: '2023-08-01',
          tprReviewPeriodStart: '1900-04-01',
          tprReviewPeriodEnd: '1900-03-31',
          tprDue: '1900-09-15',
          tprDueYearType: 'EVEN',
          tirReviewPeriodStart: '1900-07-01',
          tirReviewPeriodEnd: '1900-06-30',
          tirSubmission: '1900-10-15',
          tirReview: '1900-11-01',
        }),
      ),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });

  test('auto-calculates upcomingFieldExam and upcomingIndependentAuditRequired when pastFieldExam changes', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-past-key-dates')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('past-field-exam'), { target: { value: '2025-03-31' } });
    await userEvent.click(screen.getByTestId('button-save-past-key-dates'));

    await waitFor(() =>
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          upcomingFieldExam: '2028-03-01',
          upcomingIndependentAuditRequired: '2031-03-01',
        }),
      ),
    );
  });

  test('auto-calculates upcomingFieldExam and upcomingIndependentAuditRequired when pastAudit changes', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
    const putSpy = vi.spyOn(Api2, 'putUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-past-key-dates')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('past-audit'), { target: { value: '2024-06-15' } });
    await userEvent.click(screen.getByTestId('button-save-past-key-dates'));

    await waitFor(() =>
      expect(putSpy).toHaveBeenCalledWith(
        'trustee-001',
        'appointment-001',
        expect.objectContaining({
          upcomingFieldExam: '2027-06-01',
          upcomingIndependentAuditRequired: '2030-06-01',
        }),
      ),
    );
  });

  test('shows error alert when fetch fails', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('Network failure'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-past-key-dates')).toBeInTheDocument();
    });
  });

  test('shows error alert when save fails and re-enables save button', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
    vi.spyOn(Api2, 'putUpcomingKeyDates').mockRejectedValue(new Error('Server error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-past-key-dates')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('button-save-past-key-dates'));

    await waitFor(() => {
      const saveButton = screen.getByTestId('button-save-past-key-dates');
      expect(saveButton).not.toBeDisabled();
      expect(saveButton).toHaveTextContent('Save');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('disables save button and shows Saving text while save is in progress', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
    let resolvePut: (value: { data: null }) => void;
    vi.spyOn(Api2, 'putUpcomingKeyDates').mockImplementation(
      () =>
        new Promise<{ data: null }>((resolve) => {
          resolvePut = resolve;
        }),
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-past-key-dates')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('button-save-past-key-dates'));

    await waitFor(() => {
      const saveButton = screen.getByTestId('button-save-past-key-dates');
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

    await waitFor(() => {
      expect(screen.getByTestId('edit-past-key-dates')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('button-cancel-past-key-dates'));

    expect(putSpy).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });
});
