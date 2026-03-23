import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import TrusteeDetailAuditHistory from './TrusteeDetailAuditHistory';
import Api2 from '@/lib/models/api2';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { TrusteeUpcomingReportDatesHistory } from '@common/cams/trustee-upcoming-report-dates';

function renderComponent(trusteeId = 'trustee-001') {
  return render(
    <BrowserRouter>
      <TrusteeDetailAuditHistory trusteeId={trusteeId} />
    </BrowserRouter>,
  );
}

const baseHistory: Omit<TrusteeUpcomingReportDatesHistory, 'before' | 'after'> = {
  id: 'history-001',
  documentType: 'AUDIT_UPCOMING_REPORT_DATES',
  trusteeId: 'trustee-001',
  appointmentId: 'appointment-001',
  createdBy: SYSTEM_USER_REFERENCE,
  createdOn: '2026-03-01T00:00:00.000Z',
  updatedBy: { id: 'user-001', name: 'Jane Attorney' },
  updatedOn: '2026-03-15T00:00:00.000Z',
};

describe('TrusteeDetailAuditHistory — AUDIT_UPCOMING_REPORT_DATES', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders a row for AUDIT_UPCOMING_REPORT_DATES with change type "Upcoming Report Dates"', async () => {
    const history: TrusteeUpcomingReportDatesHistory = {
      ...baseHistory,
      before: { fieldExam: '2026-05-01' },
      after: { fieldExam: '2026-06-15' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('change-type-upcoming-report-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('change-type-upcoming-report-dates-0')).toHaveTextContent(
      'Upcoming Report Dates',
    );
  });

  test('shows only changed fields in Previous and New columns — fieldExam', async () => {
    const history: TrusteeUpcomingReportDatesHistory = {
      ...baseHistory,
      before: { fieldExam: '2026-05-01' },
      after: { fieldExam: '2026-06-15' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('previous-upcoming-report-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-upcoming-report-dates-0')).toHaveTextContent('Field Exam:');
    expect(screen.getByTestId('previous-upcoming-report-dates-0')).toHaveTextContent('05/01/2026');
    expect(screen.getByTestId('new-upcoming-report-dates-0')).toHaveTextContent('Field Exam:');
    expect(screen.getByTestId('new-upcoming-report-dates-0')).toHaveTextContent('06/15/2026');
  });

  test('does not show unrelated fields when only one field changed', async () => {
    const history: TrusteeUpcomingReportDatesHistory = {
      ...baseHistory,
      before: { fieldExam: '2026-05-01' },
      after: { fieldExam: '2026-06-15' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('previous-upcoming-report-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-upcoming-report-dates-0')).not.toHaveTextContent('Audit');
    expect(screen.getByTestId('previous-upcoming-report-dates-0')).not.toHaveTextContent(
      'TPR Review Period',
    );
  });

  test('formats audit field as MM/YYYY', async () => {
    const history: TrusteeUpcomingReportDatesHistory = {
      ...baseHistory,
      before: { audit: '2025-08-01' },
      after: { audit: '2026-08-01' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('previous-upcoming-report-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-upcoming-report-dates-0')).toHaveTextContent('08/2025');
    expect(screen.getByTestId('new-upcoming-report-dates-0')).toHaveTextContent('08/2026');
  });

  test('formats TPR Review Period range field as MM/DD - MM/DD', async () => {
    const history: TrusteeUpcomingReportDatesHistory = {
      ...baseHistory,
      before: { tprReviewPeriodStart: '1900-04-01', tprReviewPeriodEnd: '1900-03-31' },
      after: { tprReviewPeriodStart: '1900-05-01', tprReviewPeriodEnd: '1900-04-30' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('previous-upcoming-report-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-upcoming-report-dates-0')).toHaveTextContent(
      'TPR Review Period:',
    );
    expect(screen.getByTestId('previous-upcoming-report-dates-0')).toHaveTextContent(
      '04/01 - 03/31',
    );
    expect(screen.getByTestId('new-upcoming-report-dates-0')).toHaveTextContent('05/01 - 04/30');
  });

  test('formats TIR Submission and TIR Review fields as MM/DD', async () => {
    const history: TrusteeUpcomingReportDatesHistory = {
      ...baseHistory,
      before: { tirSubmission: '1900-10-15', tirReview: '1900-11-01' },
      after: { tirSubmission: '1900-11-15', tirReview: '1900-12-01' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('previous-upcoming-report-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-upcoming-report-dates-0')).toHaveTextContent(
      'TIR Submission:',
    );
    expect(screen.getByTestId('previous-upcoming-report-dates-0')).toHaveTextContent('10/15');
    expect(screen.getByTestId('previous-upcoming-report-dates-0')).toHaveTextContent('TIR Review:');
    expect(screen.getByTestId('previous-upcoming-report-dates-0')).toHaveTextContent('11/01');

    expect(screen.getByTestId('new-upcoming-report-dates-0')).toHaveTextContent('11/15');
    expect(screen.getByTestId('new-upcoming-report-dates-0')).toHaveTextContent('12/01');
  });

  test('shows (none) when before is undefined', async () => {
    const history: TrusteeUpcomingReportDatesHistory = {
      ...baseHistory,
      before: undefined,
      after: { fieldExam: '2026-06-15' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('previous-upcoming-report-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-upcoming-report-dates-0')).toHaveTextContent('(none)');
    expect(screen.getByTestId('new-upcoming-report-dates-0')).toHaveTextContent('06/15/2026');
  });

  test('shows (none) for a cleared field value', async () => {
    const history: TrusteeUpcomingReportDatesHistory = {
      ...baseHistory,
      before: { fieldExam: '2026-05-01' },
      after: { fieldExam: undefined },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('new-upcoming-report-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-upcoming-report-dates-0')).toHaveTextContent('05/01/2026');
    expect(screen.getByTestId('new-upcoming-report-dates-0')).toHaveTextContent('(none)');
  });

  test('shows changed-by name and formatted date', async () => {
    const history: TrusteeUpcomingReportDatesHistory = {
      ...baseHistory,
      before: { fieldExam: '2026-05-01' },
      after: { fieldExam: '2026-06-15' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('changed-by-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('changed-by-0')).toHaveTextContent('Jane Attorney');
    expect(screen.getByTestId('change-date-0')).toBeInTheDocument();
  });
});
