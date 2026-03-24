import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import UpcomingReportDates, { UpcomingReportDatesProps } from './UpcomingReportDates';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import { TrusteeUpcomingReportDates } from '@common/cams/trustee-upcoming-report-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

const mockUseNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: mockUseNavigate,
  };
});

const defaultProps: UpcomingReportDatesProps = {
  trusteeId: 'trustee-001',
  appointmentId: 'appointment-001',
  appointmentHeading: 'Southern District of New York (Manhattan) - Chapter 7 Panel',
};

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
  tprDue: '1900-09-15',
  tprDueYearParity: 'EVEN',
  tirReviewPeriodStart: '1900-07-01',
  tirReviewPeriodEnd: '1900-06-30',
  tirSubmission: '1900-10-15',
  tirReview: '1900-11-01',
  nextFieldExam: '2029-08-01',
  nextIndependentAuditRequired: '2032-08-01',
};

function renderComponent(props?: Partial<UpcomingReportDatesProps>) {
  return render(
    <BrowserRouter>
      <UpcomingReportDates {...defaultProps} {...props} />
    </BrowserRouter>,
  );
}

describe('UpcomingReportDates', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
  });

  test('renders "No date added" for all fields when API returns null', async () => {
    vi.spyOn(Api2, 'getUpcomingReportDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-report-dates-card')).toBeInTheDocument();
    });

    const noDateElements = screen.getAllByText('No date added');
    expect(noDateElements.length).toBe(8);
  });

  test('renders all field labels', async () => {
    vi.spyOn(Api2, 'getUpcomingReportDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-report-dates-card')).toBeInTheDocument();
    });

    expect(screen.getByText('Field Exam:')).toBeInTheDocument();
    expect(screen.getByText('Audit:')).toBeInTheDocument();
    expect(screen.getByText('TPR Review Period:')).toBeInTheDocument();
    expect(screen.getByText('TPR Due:')).toBeInTheDocument();
    expect(screen.getByText('Year Qualifier:')).toBeInTheDocument();
    expect(screen.getByText('TIR Review Period:')).toBeInTheDocument();
    expect(screen.getByText('TIR Submission:')).toBeInTheDocument();
    expect(screen.getByText('TIR Review:')).toBeInTheDocument();
    expect(screen.queryByText('Next Field Exam / Independent Audit:')).not.toBeInTheDocument();
    expect(screen.queryByText('Next Independent Audit Required:')).not.toBeInTheDocument();
  });

  test('renders correctly formatted values when API returns populated document', async () => {
    vi.spyOn(Api2, 'getUpcomingReportDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-report-dates-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('field-exam-row')).toHaveTextContent('08/01/2029');
    expect(screen.getByTestId('audit-row')).toHaveTextContent('08/01/2032');
    expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('04/01 - 03/31');
    expect(screen.getByTestId('tpr-due-row')).toHaveTextContent('09/15');
    expect(screen.getByTestId('tpr-due-year-qualifier-row')).toHaveTextContent('EVEN');
    expect(screen.getByTestId('tir-review-period-row')).toHaveTextContent('07/01 - 06/30');
    expect(screen.getByTestId('tir-submission-row')).toHaveTextContent('10/15');
    expect(screen.getByTestId('tir-review-row')).toHaveTextContent('11/01');
  });

  test('Field Exam and Audit rows appear before TPR rows', async () => {
    vi.spyOn(Api2, 'getUpcomingReportDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-report-dates-list')).toBeInTheDocument();
    });

    const list = screen.getByTestId('upcoming-report-dates-list');
    const items = list.querySelectorAll('li');
    expect(items[0]).toHaveAttribute('data-testid', 'field-exam-row');
    expect(items[1]).toHaveAttribute('data-testid', 'audit-row');
    expect(items[2]).toHaveAttribute('data-testid', 'tpr-review-period-row');
  });

  test('shows "No date added" for TPR Review Period when only start is defined', async () => {
    vi.spyOn(Api2, 'getUpcomingReportDates').mockResolvedValue({
      data: { ...populatedDocument, tprReviewPeriodEnd: undefined },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tpr-review-period-row')).toBeInTheDocument();
    });

    expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('No date added');
  });

  test('shows "No date added" for TIR Review Period when only start is defined', async () => {
    vi.spyOn(Api2, 'getUpcomingReportDates').mockResolvedValue({
      data: { ...populatedDocument, tirReviewPeriodEnd: undefined },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tir-review-period-row')).toBeInTheDocument();
    });

    expect(screen.getByTestId('tir-review-period-row')).toHaveTextContent('No date added');
  });

  test('Edit button is visible for TrusteeAdmin users', async () => {
    vi.spyOn(Api2, 'getUpcomingReportDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-report-dates-card')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /edit upcoming report dates/i })).toBeInTheDocument();
  });

  test('Edit button is not visible for non-TrusteeAdmin users', async () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);
    vi.spyOn(Api2, 'getUpcomingReportDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-report-dates-card')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /edit upcoming report dates/i }),
    ).not.toBeInTheDocument();
  });

  test('shows loading spinner while fetching', () => {
    vi.spyOn(Api2, 'getUpcomingReportDates').mockImplementation(() => new Promise(() => {}));

    renderComponent();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('upcoming-report-dates-card')).not.toBeInTheDocument();
  });

  test('renders "No date added" for all fields when API call fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Api2, 'getUpcomingReportDates').mockRejectedValue(new Error('Network error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-report-dates-card')).toBeInTheDocument();
    });

    const noDateElements = screen.getAllByText('No date added');
    expect(noDateElements.length).toBe(8);
  });

  test('Edit button navigates to edit route', async () => {
    vi.spyOn(Api2, 'getUpcomingReportDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /edit upcoming report dates/i }),
      ).toBeInTheDocument();
    });

    screen.getByRole('button', { name: /edit upcoming report dates/i }).click();

    expect(mockNavigate).toHaveBeenCalledWith(
      `/trustees/${defaultProps.trusteeId}/appointments/${defaultProps.appointmentId}/upcoming-report-dates/edit`,
      { state: { subHeading: defaultProps.appointmentHeading } },
    );
  });
});
