import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import AnnualReportKeyDatesCard from './AnnualReportKeyDatesCard';
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

describe('AnnualReportKeyDatesCard', () => {
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
    annualReportCompletionYear: 2025,
    annualReportCompletionStatus: 'Complete',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate = vi.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
  });

  function renderCard(
    data: TrusteeUpcomingKeyDates | null = keyDates,
    isLoading = false,
    appointmentHeading?: string,
  ) {
    return render(
      <BrowserRouter>
        <AnnualReportKeyDatesCard
          trusteeId="trustee-123"
          appointmentId="appointment-001"
          appointmentHeading={appointmentHeading}
          data={data}
          isLoading={isLoading}
        />
      </BrowserRouter>,
    );
  }

  test('renders the Annual Report title', () => {
    renderCard();

    expect(screen.getByRole('heading', { name: 'Annual Report' })).toBeInTheDocument();
  });

  test('displays the fixed Annual Report Submission and Due to OO values', () => {
    renderCard();

    expect(screen.getByText('Annual Report Submission')).toBeInTheDocument();
    expect(screen.getByText('09/01')).toBeInTheDocument();
    expect(screen.getByText('Annual Report Due to OO')).toBeInTheDocument();
    expect(screen.getByText('09/15')).toBeInTheDocument();
  });

  test('displays the fixed values even when there is no key dates document', () => {
    renderCard(null);

    expect(screen.getByText('09/01')).toBeInTheDocument();
    expect(screen.getByText('09/15')).toBeInTheDocument();
  });

  test('renders a green tag when the annual report is complete', () => {
    renderCard();

    const tag = screen.getByTestId('tag-annual-report-completion-status-appointment-001');
    expect(tag).toHaveTextContent('Complete for 2025');
    // #00a91c, the USWDS success color the story calls for.
    expect(tag).toHaveClass('bg-success-vivid');
  });

  test('renders a red tag when the annual report is incomplete', () => {
    renderCard({
      ...keyDates,
      annualReportCompletionYear: 2024,
      annualReportCompletionStatus: 'Incomplete',
    });

    const tag = screen.getByTestId('tag-annual-report-completion-status-appointment-001');
    expect(tag).toHaveTextContent('Incomplete for 2024');
    // #b50909, the red the story calls for.
    expect(tag).toHaveClass('bg-secondary-dark');
  });

  // The year and status are a pair; half of one says nothing, so no tag shows.
  test.each([
    [
      'the year is missing',
      { annualReportCompletionYear: undefined, annualReportCompletionStatus: 'Complete' as const },
    ],
    [
      'the status is missing',
      { annualReportCompletionYear: 2024, annualReportCompletionStatus: undefined },
    ],
    [
      'both are missing',
      { annualReportCompletionYear: undefined, annualReportCompletionStatus: undefined },
    ],
  ])('renders no completion tag when %s', (_label, overrides) => {
    renderCard({ ...keyDates, ...overrides });

    expect(
      screen.queryByTestId('tag-annual-report-completion-status-appointment-001'),
    ).not.toBeInTheDocument();
  });

  test('navigates to the annual report edit page with the appointment heading', async () => {
    renderCard(keyDates, false, 'Southern District of New York (Manhattan): Chapter 12');

    await userEvent.click(screen.getByRole('button', { name: /edit annual report/i }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/trustees/trustee-123/appointments/appointment-001/annual-report-key-dates/edit',
      { state: { subHeading: 'Southern District of New York (Manhattan): Chapter 12' } },
    );
  });

  test('navigates with an empty subHeading when no appointment heading is supplied', async () => {
    renderCard();

    await userEvent.click(screen.getByRole('button', { name: /edit annual report/i }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/trustees/trustee-123/appointments/appointment-001/annual-report-key-dates/edit',
      { state: { subHeading: '' } },
    );
  });

  test('hides the edit control for a user without the TrusteeAdmin role', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    renderCard();

    expect(screen.queryByRole('button', { name: /edit annual report/i })).not.toBeInTheDocument();
  });

  test('renders a loading spinner while key dates are loading', () => {
    renderCard(null, true);

    expect(
      screen.getByTestId('annual-report-key-dates-loading-appointment-001'),
    ).toBeInTheDocument();
    expect(screen.queryByText('09/01')).not.toBeInTheDocument();
  });
});
