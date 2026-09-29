import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import TrusteePerformanceReportCard from './TrusteePerformanceReportCard';
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

describe('TrusteePerformanceReportCard', () => {
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
    variant: 'chapter7-panel' | 'chapter12-standing' = 'chapter7-panel',
  ) {
    return render(
      <BrowserRouter>
        <TrusteePerformanceReportCard
          trusteeId="trustee-123"
          appointmentId="appointment-001"
          data={data}
          isLoading={isLoading}
          variant={variant}
        />
      </BrowserRouter>,
    );
  }

  test('renders the Trustee Performance Report title', () => {
    renderCard();

    expect(screen.getByRole('heading', { name: 'Trustee Performance Report' })).toBeInTheDocument();
  });

  test('renders all four TPR column headers including frequency', () => {
    renderCard();

    expect(screen.getByText('TPR Review Period')).toBeInTheDocument();
    expect(screen.getByText('TPR Review Period Frequency')).toBeInTheDocument();
    expect(screen.getByText('TPR Due')).toBeInTheDocument();
    expect(screen.getByText('Last TPR Submitted')).toBeInTheDocument();
  });

  test('renders values from a populated TrusteeUpcomingKeyDates', () => {
    renderCard();

    expect(screen.getByTestId('chapter7-panel-tpr-review-period-row')).toHaveTextContent(
      '04/01 - 03/31',
    );
    expect(screen.getByTestId('chapter7-panel-tpr-review-period-frequency-row')).toHaveTextContent(
      'One year',
    );
    expect(screen.getByTestId('chapter7-panel-tpr-due-row')).toHaveTextContent('09/15/2026');
    expect(screen.getByTestId('chapter7-panel-last-tpr-submitted-row')).toHaveTextContent(
      '09/10/2025',
    );
  });

  test('renders placeholders when data is null', () => {
    renderCard(null);

    expect(screen.getByTestId('chapter7-panel-tpr-review-period-row')).toHaveTextContent(
      'No date added',
    );
    expect(screen.getByTestId('chapter7-panel-tpr-review-period-frequency-row')).toHaveTextContent(
      'No frequency selected',
    );
    expect(screen.getByTestId('chapter7-panel-tpr-due-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('chapter7-panel-last-tpr-submitted-row')).toHaveTextContent(
      'No date added',
    );
  });

  test('renders a green "Complete for <year>" tag when completion status is COMPLETE', () => {
    renderCard();

    const tag = screen.getByTestId('tag-tpr-completion-status-appointment-001');
    expect(tag).toHaveTextContent('Complete for 2025');
  });

  test('renders a red "Incomplete for <year>" tag when completion status is INCOMPLETE', () => {
    renderCard({ ...keyDates, tprCompletionYear: 2024, tprCompletionStatus: 'INCOMPLETE' });

    const tag = screen.getByTestId('tag-tpr-completion-status-appointment-001');
    expect(tag).toHaveTextContent('Incomplete for 2024');
  });

  test.each<[Partial<TrusteeUpcomingKeyDates>]>([
    [{ tprCompletionYear: undefined, tprCompletionStatus: 'COMPLETE' }],
    [{ tprCompletionYear: 2025, tprCompletionStatus: undefined }],
    [{ tprCompletionYear: undefined, tprCompletionStatus: undefined }],
  ])('renders no completion tag when only one of year/status is set', (overrides) => {
    renderCard({
      ...keyDates,
      ...overrides,
    });

    expect(
      screen.queryByTestId('tag-tpr-completion-status-appointment-001'),
    ).not.toBeInTheDocument();
  });

  test('renders a loading spinner when isLoading is true', () => {
    renderCard(null, true);

    expect(screen.getByTestId('chapter7-panel-tpr-loading')).toBeInTheDocument();
    expect(screen.queryByText('Trustee Performance Report')).not.toBeInTheDocument();
  });

  test('renders an Edit button for a user with TrusteeAdmin role', () => {
    renderCard();

    expect(
      screen.getByTestId('button-edit-chapter7-panel-tpr-appointment-001'),
    ).toBeInTheDocument();
  });

  test('does not render an Edit button for a user without TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    renderCard();

    expect(
      screen.queryByTestId('button-edit-chapter7-panel-tpr-appointment-001'),
    ).not.toBeInTheDocument();
  });

  test.each([
    [
      'chapter7-panel' as const,
      '/trustees/trustee-123/appointments/appointment-001/tpr-key-dates/edit',
    ],
    [
      'chapter12-standing' as const,
      '/trustees/trustee-123/appointments/appointment-001/chapter12-standing-tpr-key-dates/edit',
    ],
  ])('navigates to the edit route for %s variant', async (variant, expectedRoute) => {
    renderCard(keyDates, false, variant);

    await userEvent.click(screen.getByTestId(`button-edit-${variant}-tpr-appointment-001`));

    expect(mockNavigate).toHaveBeenCalledWith(expectedRoute);
  });
});
