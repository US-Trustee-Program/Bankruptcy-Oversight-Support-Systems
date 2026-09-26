import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import TrusteePerformanceReportKeyDatesCard from './TrusteePerformanceReportKeyDatesCard';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { CamsRole } from '@common/cams/roles';
import TestingUtilities from '@/lib/testing/testing-utilities';

const mockUseNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: mockUseNavigate,
  };
});

describe('TrusteePerformanceReportKeyDatesCard', () => {
  let mockNavigate: ReturnType<typeof vi.fn>;

  const keyDates: TrusteeUpcomingKeyDates = {
    id: 'key-dates-001',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-123',
    appointmentId: 'appointment-001',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    tprReviewPeriodStart: '1900-04-01',
    tprReviewPeriodEnd: '1900-03-31',
    tprDue: '1900-09-15',
    tprDueYearType: 'EVEN',
    tprFrequency: 'ANNUAL',
    lastTprSubmitted: '2025-09-10',
    tprCompletionYear: 2025,
    tprCompletionStatus: 'COMPLETE',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2025-06-15T00:00:00.000Z'));
    mockNavigate = vi.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderCard(
    data: TrusteeUpcomingKeyDates | null = keyDates,
    isLoading = false,
    appointmentHeading?: string,
    tprDisplayUpdates = true,
  ) {
    return render(
      <BrowserRouter>
        <TrusteePerformanceReportKeyDatesCard
          trusteeId="trustee-123"
          appointmentId="appointment-001"
          appointmentHeading={appointmentHeading}
          data={data}
          isLoading={isLoading}
          tprDisplayUpdates={tprDisplayUpdates}
        />
      </BrowserRouter>,
    );
  }

  test('renders the Trustee Performance Report title', () => {
    renderCard();

    expect(screen.getByRole('heading', { name: 'Trustee Performance Report' })).toBeInTheDocument();
  });

  test('renders the four TPR column headers', () => {
    renderCard();

    expect(screen.getByText('TPR Review Period')).toBeInTheDocument();
    expect(screen.getByText('TPR Review Period Frequency')).toBeInTheDocument();
    expect(screen.getByText('TPR Due')).toBeInTheDocument();
    expect(screen.getByText('Last TPR Submitted')).toBeInTheDocument();
  });

  test('formats a sentinel review period as a month/day range', () => {
    renderCard();

    expect(screen.getByTestId('tpr-review-period')).toHaveTextContent('04/01 - 03/31');
  });

  test('formats a real-dated review period with full dates', () => {
    renderCard({
      ...keyDates,
      tprReviewPeriodStart: '2025-01-01',
      tprReviewPeriodEnd: '2025-12-31',
    });

    expect(screen.getByTestId('tpr-review-period')).toHaveTextContent('01/01/2025 - 12/31/2025');
  });

  test('renders the frequency label for the stored frequency code', () => {
    renderCard();

    expect(screen.getByTestId('tpr-frequency')).toHaveTextContent('One year');
  });

  test('renders the resolved TPR due date', () => {
    // The due-year rule itself is covered in tprFieldFormatters.test.ts; this
    // only checks the card surfaces the formatted value.
    vi.setSystemTime(new Date('2025-06-15T00:00:00.000Z'));

    renderCard();

    expect(screen.getByTestId('tpr-due')).toHaveTextContent('09/15/2026');
  });

  test('formats the last submitted date', () => {
    renderCard();

    expect(screen.getByTestId('last-tpr-submitted')).toHaveTextContent('09/10/2025');
  });

  test('shows placeholders for every field when there is no key dates document', () => {
    renderCard(null);

    expect(screen.getByTestId('tpr-review-period')).toHaveTextContent('No date added');
    expect(screen.getByTestId('tpr-frequency')).toHaveTextContent('No frequency selected');
    expect(screen.getByTestId('tpr-due')).toHaveTextContent('No date added');
    expect(screen.getByTestId('last-tpr-submitted')).toHaveTextContent('No date added');
  });

  test('renders a green tag when the report is complete', () => {
    renderCard();

    const tag = screen.getByTestId('tag-tpr-completion-status-appointment-001');
    expect(tag).toHaveTextContent('Complete for 2025');
    expect(tag).toHaveClass('bg-success-vivid');
  });

  test('renders a red tag when the report is incomplete', () => {
    renderCard({ ...keyDates, tprCompletionYear: 2024, tprCompletionStatus: 'INCOMPLETE' });

    const tag = screen.getByTestId('tag-tpr-completion-status-appointment-001');
    expect(tag).toHaveTextContent('Incomplete for 2024');
    expect(tag).toHaveClass('bg-secondary-dark');
  });

  test('renders no completion tag when the pair is incomplete', () => {
    renderCard({
      ...keyDates,
      tprCompletionYear: undefined,
      tprCompletionStatus: undefined,
    });

    expect(
      screen.queryByTestId('tag-tpr-completion-status-appointment-001'),
    ).not.toBeInTheDocument();
  });

  test('navigates to the TPR edit page', async () => {
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: /edit trustee performance report/i }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/trustees/trustee-123/appointments/appointment-001/ch12-13-tpr-key-dates/edit',
    );
  });

  test('hides the edit control for a user without the TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    renderCard();

    expect(
      screen.queryByRole('button', { name: /edit trustee performance report/i }),
    ).not.toBeInTheDocument();
  });

  test('renders a loading spinner while key dates are loading', () => {
    renderCard(null, true);

    expect(screen.getByTestId('tpr-key-dates-loading-appointment-001')).toBeInTheDocument();
    expect(screen.queryByTestId('tpr-review-period')).not.toBeInTheDocument();
  });

  // The Chapter 7 Panel card gates these on the same flag; the rollout has to
  // look the same for both appointment types on the same page.
  describe('with TPR_DISPLAY_UPDATES disabled', () => {
    function renderWithFlagOff(data: TrusteeUpcomingKeyDates | null = keyDates) {
      return renderCard(data, false, undefined, false);
    }

    test('hides the frequency column', () => {
      renderWithFlagOff();

      expect(screen.queryByText('TPR Review Period Frequency')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tpr-frequency')).not.toBeInTheDocument();
    });

    test('renders the review period in the legacy month/day format', () => {
      renderWithFlagOff();

      expect(screen.getByTestId('tpr-review-period')).toHaveTextContent('04/01 - 03/31');
    });

    test('renders the due date in the legacy date-plus-year-type format', () => {
      renderWithFlagOff();

      expect(screen.getByTestId('tpr-due')).toHaveTextContent('09/15 EVEN');
    });

    test('still renders the columns the flag does not gate', () => {
      renderWithFlagOff();

      expect(screen.getByTestId('last-tpr-submitted')).toHaveTextContent('09/10/2025');
      expect(screen.getByTestId('tag-tpr-completion-status-appointment-001')).toBeInTheDocument();
    });

    test('falls back to the placeholder when the legacy fields are absent', () => {
      renderWithFlagOff(null);

      expect(screen.getByTestId('tpr-review-period')).toHaveTextContent('No date added');
      expect(screen.getByTestId('tpr-due')).toHaveTextContent('No date added');
    });
  });
});
