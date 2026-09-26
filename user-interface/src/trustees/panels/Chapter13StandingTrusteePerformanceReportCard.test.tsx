import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Chapter13StandingTrusteePerformanceReportCard, {
  Chapter13StandingTrusteePerformanceReportCardProps,
} from './Chapter13StandingTrusteePerformanceReportCard';
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

const defaultProps: Chapter13StandingTrusteePerformanceReportCardProps = {
  trusteeId: 'trustee-001',
  appointmentId: 'appointment-001',
  data: null,
};

const baseDocument: TrusteeUpcomingKeyDates = {
  id: 'doc-001',
  documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
  trusteeId: 'trustee-001',
  appointmentId: 'appointment-001',
  createdBy: SYSTEM_USER_REFERENCE,
  createdOn: '2026-01-01T00:00:00.000Z',
  updatedBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2026-01-01T00:00:00.000Z',
};

function renderComponent(props?: Partial<Chapter13StandingTrusteePerformanceReportCardProps>) {
  return render(
    <BrowserRouter>
      <Chapter13StandingTrusteePerformanceReportCard {...defaultProps} {...props} />
    </BrowserRouter>,
  );
}

describe('Chapter13StandingTrusteePerformanceReportCard', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    mockUseNavigate.mockReturnValue(mockNavigate);
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
  });

  test('renders the Trustee Performance Report title and TPR Review Period, Frequency, and Due rows', () => {
    renderComponent();
    expect(screen.getByText('Trustee Performance Report')).toBeInTheDocument();
    expect(screen.getByTestId('tpr-review-period-row')).toBeInTheDocument();
    expect(screen.getByTestId('tpr-review-period-frequency-row')).toBeInTheDocument();
    expect(screen.getByTestId('tpr-due-row')).toBeInTheDocument();
  });

  // The exhaustive date/frequency formatting logic for these fields is covered by
  // upcomingKeyDatesFieldConfig.test.ts; this only confirms this card forwards `data`
  // to them rather than always passing null.
  test('renders TPR Review Period, Frequency, and Due values from data', () => {
    renderComponent({
      data: {
        ...baseDocument,
        tprReviewPeriodStart: '2025-04-01',
        tprReviewPeriodEnd: '2025-09-30',
        tprFrequency: 'ANNUAL',
        tprDue: '1900-09-15',
        tprDueYearType: 'EVEN',
      },
    });
    expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('04/01/2025');
    expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('09/30/2025');
    expect(screen.getByTestId('tpr-review-period-frequency-row')).toHaveTextContent('One year');
    expect(screen.getByTestId('tpr-due-row')).not.toHaveTextContent('No date added');
  });

  test('renders "No date added" for Last TPR Submitted when data is null', () => {
    renderComponent();
    expect(screen.getByTestId('last-tpr-submitted-row')).toHaveTextContent('No date added');
  });

  test('renders formatted Last TPR Submitted when pastTprSubmission is set', () => {
    renderComponent({ data: { ...baseDocument, pastTprSubmission: '2025-06-30' } });
    expect(screen.getByTestId('last-tpr-submitted-row')).toHaveTextContent('06/30/2025');
  });

  test('renders no completion-status tag when ch13TprCompletionYear/Status are unset', () => {
    renderComponent();
    expect(
      screen.queryByTestId('tag-tpr-completion-status-appointment-001'),
    ).not.toBeInTheDocument();
  });

  test.each([
    ['ch13TprCompletionYear only', { ch13TprCompletionYear: 2026 }],
    ['ch13TprCompletionStatus only', { ch13TprCompletionStatus: 'Complete' as const }],
  ])('renders no completion-status tag when only %s is set', (_label, partialData) => {
    renderComponent({ data: { ...baseDocument, ...partialData } });
    expect(
      screen.queryByTestId('tag-tpr-completion-status-appointment-001'),
    ).not.toBeInTheDocument();
  });

  test('renders a "Complete for {year}" tag when ch13TprCompletionStatus is Complete', () => {
    renderComponent({
      data: { ...baseDocument, ch13TprCompletionYear: 2026, ch13TprCompletionStatus: 'Complete' },
    });
    expect(screen.getByTestId('tag-tpr-completion-status-appointment-001')).toHaveTextContent(
      'Complete for 2026',
    );
  });

  test('renders an "Incomplete for {year}" tag when ch13TprCompletionStatus is Incomplete', () => {
    renderComponent({
      data: { ...baseDocument, ch13TprCompletionYear: 2026, ch13TprCompletionStatus: 'Incomplete' },
    });
    expect(screen.getByTestId('tag-tpr-completion-status-appointment-001')).toHaveTextContent(
      'Incomplete for 2026',
    );
  });

  test('Edit pencil navigates to the dedicated TPR edit route when canManage', () => {
    renderComponent();
    screen.getByRole('button', { name: /edit trustee performance report key dates/i }).click();
    expect(mockNavigate).toHaveBeenCalledWith(
      '/trustees/trustee-001/appointments/appointment-001/chapter13-standing-tpr-key-dates/edit',
    );
  });

  test('does not render an edit button when user cannot manage trustees', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);
    renderComponent();
    expect(
      screen.queryByRole('button', { name: /edit trustee performance report key dates/i }),
    ).not.toBeInTheDocument();
  });
});
