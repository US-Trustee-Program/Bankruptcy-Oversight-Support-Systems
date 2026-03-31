import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import PastKeyDates, { PastKeyDatesProps } from './PastKeyDates';
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

const defaultProps: PastKeyDatesProps = {
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
  pastBackgroundQuestion: '2022-05-10',
  pastFieldExam: '2024-02-21',
  pastAudit: '2023-02-22',
  pastTprSubmission: '2025-11-03',
  tprReviewPeriodStart: '1900-04-01',
  tprReviewPeriodEnd: '1900-03-31',
  tprDue: '2026-09-01',
  tirReviewPeriodStart: '1900-07-01',
  tirReviewPeriodEnd: '1900-06-30',
  tirSubmission: '1900-10-15',
  tirReview: '1900-11-01',
  upcomingFieldExam: '2029-08-01',
  upcomingIndependentAuditRequired: '2032-08-01',
};

function renderComponent(props?: Partial<PastKeyDatesProps>) {
  return render(
    <BrowserRouter>
      <PastKeyDates {...defaultProps} {...props} />
    </BrowserRouter>,
  );
}

describe('PastKeyDates', () => {
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
      expect(screen.getByTestId('past-key-dates-card')).toBeInTheDocument();
    });

    const noDateElements = screen.getAllByText('No date added');
    expect(noDateElements.length).toBe(4);
  });

  test('renders all field labels', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('past-key-dates-card')).toBeInTheDocument();
    });

    expect(screen.getByText('Background Question:')).toBeInTheDocument();
    expect(screen.getByText('Field Exam:')).toBeInTheDocument();
    expect(screen.getByText('Audit:')).toBeInTheDocument();
    expect(screen.getByText('TPR Submission:')).toBeInTheDocument();
  });

  test('renders correctly formatted values when API returns populated document', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('past-key-dates-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('past-background-question-row')).toHaveTextContent('05/10/2022');
    expect(screen.getByTestId('past-field-exam-row')).toHaveTextContent('02/21/2024');
    expect(screen.getByTestId('past-audit-row')).toHaveTextContent('02/22/2023');
    expect(screen.getByTestId('past-tpr-submission-row')).toHaveTextContent('11/03/2025');
  });

  test('renders "No date added" for background question and tpr submission when absent', async () => {
    const docWithoutNewFields: TrusteeUpcomingKeyDates = {
      ...populatedDocument,
      pastBackgroundQuestion: undefined,
      pastTprSubmission: undefined,
    };
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: docWithoutNewFields });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('past-key-dates-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('past-background-question-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('past-tpr-submission-row')).toHaveTextContent('No date added');
  });

  test('renders fields in correct order: background question, field exam, audit, tpr submission', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('past-key-dates-list')).toBeInTheDocument();
    });

    const listItems = screen.getByTestId('past-key-dates-list').querySelectorAll('li');
    expect(listItems[0]).toHaveAttribute('data-testid', 'past-background-question-row');
    expect(listItems[1]).toHaveAttribute('data-testid', 'past-field-exam-row');
    expect(listItems[2]).toHaveAttribute('data-testid', 'past-audit-row');
    expect(listItems[3]).toHaveAttribute('data-testid', 'past-tpr-submission-row');
  });

  test('Edit button is visible for TrusteeAdmin users', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('past-key-dates-card')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /edit past key dates/i })).toBeInTheDocument();
  });

  test('Edit button is not visible for non-TrusteeAdmin users', async () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('past-key-dates-card')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /edit past key dates/i })).not.toBeInTheDocument();
  });

  test('shows loading spinner while fetching', () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockImplementation(() => new Promise(() => {}));

    renderComponent();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('past-key-dates-card')).not.toBeInTheDocument();
  });

  test('renders "No date added" for all fields when API call fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('Network failure'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('past-key-dates-card')).toBeInTheDocument();
    });

    const noDateElements = screen.getAllByText('No date added');
    expect(noDateElements.length).toBe(4);
  });

  test('Edit button navigates to edit route', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit past key dates/i })).toBeInTheDocument();
    });

    screen.getByRole('button', { name: /edit past key dates/i }).click();

    expect(mockNavigate).toHaveBeenCalledWith(
      `/trustees/${defaultProps.trusteeId}/appointments/${defaultProps.appointmentId}/past-key-dates/edit`,
      { state: { subHeading: defaultProps.appointmentHeading } },
    );
  });

  test('Edit button navigates with empty subHeading when appointmentHeading is undefined', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderComponent({ appointmentHeading: undefined });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit past key dates/i })).toBeInTheDocument();
    });

    screen.getByRole('button', { name: /edit past key dates/i }).click();

    expect(mockNavigate).toHaveBeenCalledWith(
      `/trustees/${defaultProps.trusteeId}/appointments/${defaultProps.appointmentId}/past-key-dates/edit`,
      { state: { subHeading: '' } },
    );
  });
});
