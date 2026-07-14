import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import UpcomingKeyDates, { UpcomingKeyDatesProps } from './UpcomingKeyDates';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

const mockUseNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: mockUseNavigate,
  };
});

const defaultProps: UpcomingKeyDatesProps = {
  trusteeId: 'trustee-001',
  appointmentId: 'appointment-001',
  appointmentHeading: 'Southern District of New York (Manhattan) - Chapter 7 Panel',
};

const populatedDocument: TrusteeUpcomingKeyDates = {
  id: 'doc-001',
  documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
  trusteeId: 'trustee-001',
  appointmentId: 'appointment-001',
  createdBy: SYSTEM_USER_REFERENCE,
  createdOn: '2026-01-01T00:00:00.000Z',
  updatedBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2026-01-01T00:00:00.000Z',
  upcomingExamOrAuditYear: 2029,
  upcomingExamOrAuditType: 'Field Exam',
  tirFrequency: 'ANNUAL',
  lastAuditFiscalYear: 2024,
  tprReviewPeriodStart: '1900-04-01',
  tprReviewPeriodEnd: '1900-03-31',
  tprDue: '1900-09-15',
  tprDueYearType: 'EVEN',
  tirReviewPeriodStart: '1900-07-01',
  tirReviewPeriodEnd: '1900-06-30',
  tirSubmission: '1900-10-15',
  tirReview: '1900-11-01',
};

function renderComponent(props?: Partial<UpcomingKeyDatesProps>) {
  return render(
    <BrowserRouter>
      <UpcomingKeyDates {...defaultProps} {...props} />
    </BrowserRouter>,
  );
}

describe('UpcomingKeyDates', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
  });

  test('renders "No date added" for all fields when API returns null', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();
    });

    const noDateElements = screen.getAllByText('No date added');
    expect(noDateElements.length).toBe(7);
  });

  test('renders all field labels', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();
    });

    expect(screen.getByText('Field Exam / Audit:')).toBeInTheDocument();
    expect(screen.getByText('Audit Required by:')).toBeInTheDocument();
    expect(screen.getByText('Trustee Performance Review Period:')).toBeInTheDocument();
    expect(screen.getByText('Trustee Performance Review Due:')).toBeInTheDocument();
    expect(screen.getByText('TIR Review Period:')).toBeInTheDocument();
    expect(screen.getByText('TIR Submission:')).toBeInTheDocument();
    expect(screen.getByText('TIR Due:')).toBeInTheDocument();
  });

  test('renders correctly formatted values when API returns populated document', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('upcoming-exam-audit-row')).toHaveTextContent('2029');
    expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('04/01 - 03/31');
    expect(screen.getByTestId('tpr-due-row')).toHaveTextContent('09/15 EVEN');
    expect(screen.getByTestId('tir-review-period-row')).toHaveTextContent('07/01 - 06/30');
    expect(screen.getByTestId('tir-submission-row')).toHaveTextContent('10/15');
    expect(screen.getByTestId('tir-review-row')).toHaveTextContent('11/01');
  });

  test('exam/audit row uses type as label when upcomingExamOrAuditType is set', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-exam-audit-row')).toBeInTheDocument();
    });

    expect(screen.getByText('Field Exam:')).toBeInTheDocument();
    expect(screen.getByTestId('upcoming-exam-audit-row')).toHaveTextContent('2029');
  });

  test('exam/audit row uses "Field Exam / Audit" label when type is absent', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({
      data: {
        ...populatedDocument,
        upcomingExamOrAuditType: undefined,
        upcomingExamOrAuditYear: undefined,
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-exam-audit-row')).toBeInTheDocument();
    });

    expect(screen.getByText('Field Exam / Audit:')).toBeInTheDocument();
    expect(screen.getByTestId('upcoming-exam-audit-row')).toHaveTextContent('No date added');
  });

  test('upcoming-exam-audit-row appears at index 0', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-key-dates-list')).toBeInTheDocument();
    });

    const list = screen.getByTestId('upcoming-key-dates-list');
    const items = list.querySelectorAll('li');
    expect(items[0]).toHaveAttribute('data-testid', 'upcoming-exam-audit-row');
    expect(items[1]).toHaveAttribute('data-testid', 'audit-req-by-row');
    expect(items[2]).toHaveAttribute('data-testid', 'tpr-review-period-row');
  });

  test('TIR Review Period shows both ranges joined with " & " for semi-annual', async () => {
    const semiAnnualDoc: TrusteeUpcomingKeyDates = {
      ...populatedDocument,
      tirFrequency: 'SEMI_ANNUAL',
      tirReviewPeriodStart: '1900-01-01',
      tirReviewPeriodEnd: '1900-06-30',
      tirSemiAnnualReviewPeriodStart: '1900-07-01',
      tirSemiAnnualReviewPeriodEnd: '1900-12-31',
      tirSemiAnnualSubmission: '1900-07-30',
      tirSemiAnnualReview: '1900-09-28',
    };
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: semiAnnualDoc });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tir-review-period-row')).toBeInTheDocument();
    });

    expect(screen.getByTestId('tir-review-period-row')).toHaveTextContent(
      '01/01 - 06/30 & 07/01 - 12/31',
    );
  });

  test('TIR Submission shows both dates joined with " & " for semi-annual', async () => {
    const semiAnnualDoc: TrusteeUpcomingKeyDates = {
      ...populatedDocument,
      tirFrequency: 'SEMI_ANNUAL',
      tirSubmission: '1900-10-15',
      tirSemiAnnualSubmission: '1900-04-15',
    };
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: semiAnnualDoc });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tir-submission-row')).toBeInTheDocument();
    });

    expect(screen.getByTestId('tir-submission-row')).toHaveTextContent('10/15 & 04/15');
  });

  test('renders Audit req by as calculated year when lastAuditFiscalYear is set', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('audit-req-by-row')).toBeInTheDocument();
    });

    expect(screen.getByTestId('audit-req-by-row')).toHaveTextContent('2027');
  });

  test('renders Audit req by as No date added when lastAuditFiscalYear is absent', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({
      data: { ...populatedDocument, lastAuditFiscalYear: undefined },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('audit-req-by-row')).toBeInTheDocument();
    });

    expect(screen.getByTestId('audit-req-by-row')).toHaveTextContent('No date added');
  });

  test('Audit req by row appears before TPR Review Period row', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-key-dates-list')).toBeInTheDocument();
    });

    const list = screen.getByTestId('upcoming-key-dates-list');
    const items = Array.from(list.querySelectorAll('li'));
    const auditReqByIndex = items.findIndex(
      (el) => el.getAttribute('data-testid') === 'audit-req-by-row',
    );
    const tprIndex = items.findIndex(
      (el) => el.getAttribute('data-testid') === 'tpr-review-period-row',
    );
    expect(auditReqByIndex).toBeLessThan(tprIndex);
  });

  test('shows "No date added" for TIR Review Period when only start is defined', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({
      data: { ...populatedDocument, tirReviewPeriodEnd: undefined },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tir-review-period-row')).toBeInTheDocument();
    });

    expect(screen.getByTestId('tir-review-period-row')).toHaveTextContent('No date added');
  });

  test('Edit button is visible for TrusteeAdmin users', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /edit upcoming key dates/i })).toBeInTheDocument();
  });

  test('Edit button is not visible for non-TrusteeAdmin users', async () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /edit upcoming key dates/i }),
    ).not.toBeInTheDocument();
  });

  test('shows loading spinner while fetching', () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockImplementation(() => new Promise(() => {}));

    renderComponent();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
  });

  test('renders "No date added" for all fields when API call fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('Network error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();
    });

    const noDateElements = screen.getAllByText('No date added');
    expect(noDateElements.length).toBe(7);
  });

  test('Edit button navigates to edit route', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit upcoming key dates/i })).toBeInTheDocument();
    });

    screen.getByRole('button', { name: /edit upcoming key dates/i }).click();

    expect(mockNavigate).toHaveBeenCalledWith(
      `/trustees/${defaultProps.trusteeId}/appointments/${defaultProps.appointmentId}/upcoming-key-dates/edit`,
      { state: { subHeading: defaultProps.appointmentHeading } },
    );
  });
});
