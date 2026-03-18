import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import EditUpcomingReportDates from './EditUpcomingReportDates';
import Api2 from '@/lib/models/api2';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { TrusteeUpcomingReportDates } from '@common/cams/trustee-upcoming-report-dates';
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

const populatedDocument: TrusteeUpcomingReportDates = {
  id: 'doc-001',
  documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
  trusteeId: 'trustee-001',
  appointmentId: 'appointment-001',
  createdBy: SYSTEM_USER_REFERENCE,
  createdOn: '2026-01-01T00:00:00.000Z',
  updatedBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2026-01-01T00:00:00.000Z',
  fieldExam: '2026-06-15',
  audit: '2026-08-01',
  tprReviewPeriodStart: '1900-04-01',
  tprReviewPeriodEnd: '1900-03-31',
  tprDue: '2026-09-01',
  tirReviewPeriodStart: '1900-07-01',
  tirReviewPeriodEnd: '1900-06-30',
  tirSubmission: '1900-10-15',
  tirReview: '1900-11-01',
};

function renderComponent() {
  return render(
    <BrowserRouter>
      <EditUpcomingReportDates />
    </BrowserRouter>,
  );
}

describe('EditUpcomingReportDates', () => {
  const mockNavigate = vi.fn();
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    mockUseNavigate.mockReturnValue(mockNavigate);
    userEvent = TestingUtilities.setupUserEvent();
    vi.clearAllMocks();
  });

  test('renders all 9 labeled inputs', async () => {
    vi.spyOn(Api2, 'getUpcomingReportDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-upcoming-report-dates')).toBeInTheDocument();
    });

    // DatePicker fields
    expect(screen.getByTestId('field-exam')).toBeInTheDocument();
    expect(screen.getByTestId('audit')).toBeInTheDocument();
    expect(screen.getByTestId('tpr-due')).toBeInTheDocument();
    expect(screen.getByTestId('tir-submission')).toBeInTheDocument();
    expect(screen.getByTestId('tir-review')).toBeInTheDocument();

    // MonthDaySelector fields — start selectors have labels, end selectors do not
    expect(screen.getByLabelText('TPR Review Period')).toBeInTheDocument();
    expect(document.getElementById('tpr-review-period-end-month')).toBeInTheDocument();
    expect(screen.getByLabelText('TIR Review Period')).toBeInTheDocument();
    expect(document.getElementById('tir-review-period-end-month')).toBeInTheDocument();
  });

  test('pre-populates form from API response', async () => {
    vi.spyOn(Api2, 'getUpcomingReportDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('field-exam')).toHaveValue('2026-06-15');
    });

    expect(screen.getByTestId('audit')).toHaveValue('2026-08-01');
    expect(document.getElementById('tpr-review-period-start-month')).toHaveValue('04');
    expect(document.getElementById('tpr-review-period-start-day')).toHaveValue('01');
    expect(document.getElementById('tpr-review-period-end-month')).toHaveValue('03');
    expect(document.getElementById('tpr-review-period-end-day')).toHaveValue('31');
    expect(screen.getByTestId('tpr-due')).toHaveValue('2026-09-01');
    expect(document.getElementById('tir-review-period-start-month')).toHaveValue('07');
    expect(document.getElementById('tir-review-period-start-day')).toHaveValue('01');
    expect(document.getElementById('tir-review-period-end-month')).toHaveValue('06');
    expect(document.getElementById('tir-review-period-end-day')).toHaveValue('30');
    expect(screen.getByTestId('tir-submission')).toHaveValue('1900-10-15');
    expect(screen.getByTestId('tir-review')).toHaveValue('1900-11-01');
  });

  test('shows empty inputs when API returns null', async () => {
    vi.spyOn(Api2, 'getUpcomingReportDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('field-exam')).toHaveValue('');
    });
  });

  test('shows error and blocks save when review period start is set without end', async () => {
    vi.spyOn(Api2, 'getUpcomingReportDates').mockResolvedValue({ data: null });
    const putSpy = vi.spyOn(Api2, 'putUpcomingReportDates').mockResolvedValue({ data: null });

    renderComponent();

    expect(await screen.findByTestId('edit-upcoming-report-dates')).toBeInTheDocument();

    await userEvent.selectOptions(document.getElementById('tpr-review-period-start-month')!, '04');
    await userEvent.selectOptions(document.getElementById('tpr-review-period-start-day')!, '01');
    await userEvent.click(screen.getByTestId('button-save-upcoming-report-dates'));

    expect(
      screen.getByText('TPR Review Period End is required when Start is set.'),
    ).toBeInTheDocument();
    expect(putSpy).not.toHaveBeenCalled();
  });

  test('shows error and blocks save when review period end is set without start', async () => {
    vi.spyOn(Api2, 'getUpcomingReportDates').mockResolvedValue({ data: null });
    const putSpy = vi.spyOn(Api2, 'putUpcomingReportDates').mockResolvedValue({ data: null });

    renderComponent();

    expect(await screen.findByTestId('edit-upcoming-report-dates')).toBeInTheDocument();

    await userEvent.selectOptions(document.getElementById('tir-review-period-end-month')!, '06');
    await userEvent.selectOptions(document.getElementById('tir-review-period-end-day')!, '30');
    await userEvent.click(screen.getByTestId('button-save-upcoming-report-dates'));

    expect(
      screen.getByText('TIR Review Period Start is required when End is set.'),
    ).toBeInTheDocument();
    expect(putSpy).not.toHaveBeenCalled();
  });

  test('clearing a field saves null and navigates to appointments', async () => {
    vi.spyOn(Api2, 'getUpcomingReportDates').mockResolvedValue({ data: populatedDocument });
    const putSpy = vi.spyOn(Api2, 'putUpcomingReportDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => expect(screen.getByTestId('field-exam')).toHaveValue('2026-06-15'));

    await userEvent.clear(screen.getByTestId('field-exam'));
    await userEvent.click(screen.getByTestId('button-save-upcoming-report-dates'));

    await waitFor(() => expect(putSpy).toHaveBeenCalled());
    expect(putSpy).toHaveBeenCalledWith(
      'trustee-001',
      'appointment-001',
      expect.objectContaining({ fieldExam: null }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });

  test('valid save calls putUpcomingReportDates with correct ISO body and navigates', async () => {
    vi.spyOn(Api2, 'getUpcomingReportDates').mockResolvedValue({ data: null });
    const putSpy = vi.spyOn(Api2, 'putUpcomingReportDates').mockResolvedValue({ data: null });

    renderComponent();

    expect(await screen.findByTestId('field-exam')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('field-exam'), { target: { value: '2026-06-15' } });
    await userEvent.click(screen.getByTestId('button-save-upcoming-report-dates'));

    await waitFor(() => expect(putSpy).toHaveBeenCalled());
    expect(putSpy).toHaveBeenCalledWith(
      'trustee-001',
      'appointment-001',
      expect.objectContaining({ fieldExam: '2026-06-15' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });

  test('Cancel navigates without calling PUT', async () => {
    vi.spyOn(Api2, 'getUpcomingReportDates').mockResolvedValue({ data: null });
    const putSpy = vi.spyOn(Api2, 'putUpcomingReportDates').mockResolvedValue({ data: null });

    renderComponent();

    expect(await screen.findByTestId('edit-upcoming-report-dates')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('button-cancel-upcoming-report-dates'));

    expect(putSpy).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/trustees/trustee-001/appointments');
  });
});
