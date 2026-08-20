import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Chapter12StandingUpcomingKeyDates from './Chapter12StandingUpcomingKeyDates';
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

const defaultProps = {
  trusteeId: 'trustee-ch12-001',
  appointmentId: 'appointment-ch12-001',
  appointmentHeading: 'Southern District of New York (Manhattan) - Chapter 12 Standing',
};

const populatedDocument: TrusteeUpcomingKeyDates = {
  id: 'doc-ch12-001',
  documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
  trusteeId: 'trustee-ch12-001',
  appointmentId: 'appointment-ch12-001',
  createdBy: SYSTEM_USER_REFERENCE,
  createdOn: '2026-01-01T00:00:00.000Z',
  updatedBy: SYSTEM_USER_REFERENCE,
  updatedOn: '2026-01-01T00:00:00.000Z',
  lastAuditFiscalYear: 2022,
  tprReviewPeriodStart: '1900-01-01',
  tprReviewPeriodEnd: '1900-12-31',
  tprDue: '1900-03-15',
  tprDueYearType: 'ODD',
  leaseExpiration: '2027-06-30',
  idExpiration: '2028-01-15',
};

function renderComponent() {
  return render(
    <BrowserRouter>
      <Chapter12StandingUpcomingKeyDates {...defaultProps} />
    </BrowserRouter>,
  );
}

describe('Chapter12StandingUpcomingKeyDates', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseNavigate.mockReturnValue(mockNavigate);
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });
  });

  test('renders "No date added" for all editable fields when API returns null', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('ch12-upcoming-key-dates-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('audit-req-by-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('tpr-due-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('lease-expiration-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('id-expiration-row')).toHaveTextContent('No date added');
  });

  test('renders without crashing when API rejects', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('Network error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('ch12-upcoming-key-dates-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('audit-req-by-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('tpr-due-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('lease-expiration-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('id-expiration-row')).toHaveTextContent('No date added');
  });

  test('renders all 8 row labels', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('ch12-upcoming-key-dates-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('audit-req-by-row')).toBeInTheDocument();
    expect(screen.getByTestId('annual-report-due-row')).toBeInTheDocument();
    expect(screen.getByTestId('tpr-review-period-row')).toBeInTheDocument();
    expect(screen.getByTestId('tpr-due-row')).toBeInTheDocument();
    expect(screen.getByTestId('lease-expiration-row')).toBeInTheDocument();
    expect(screen.getByTestId('budget-submission-due-row')).toBeInTheDocument();
    expect(screen.getByTestId('budget-review-to-oo-row')).toBeInTheDocument();
    expect(screen.getByTestId('id-expiration-row')).toBeInTheDocument();
  });

  test('shows Audit Req. By year derived from lastAuditFiscalYear when set', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('audit-req-by-row')).toHaveTextContent('2025');
    });
  });

  test('shows "No date added" for Audit Req. By when lastAuditFiscalYear is not set', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({
      data: { ...populatedDocument, lastAuditFiscalYear: undefined },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('audit-req-by-row')).toHaveTextContent('No date added');
    });
  });

  test.each([
    ['annual-report-due-row', '09/30'],
    ['budget-submission-due-row', '05/01'],
    ['budget-review-to-oo-row', '06/01'],
  ])('fixed-value row %s always shows %s', async (testId, expectedValue) => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId(testId)).toHaveTextContent(expectedValue);
    });
  });

  test('shows formatted tprReviewPeriod when both start and end are set', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('01/01 - 12/31');
    });
  });

  test('shows formatted tprDue with year type when both are set', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tpr-due-row')).toHaveTextContent('03/15 ODD');
    });
  });

  test('shows "No date added" for tprDue when tprDueYearType is missing', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({
      data: { ...populatedDocument, tprDueYearType: undefined },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('tpr-due-row')).toHaveTextContent('No date added');
    });
  });

  test('shows formatted leaseExpiration when set', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('lease-expiration-row')).toHaveTextContent('06/30/2027');
    });
  });

  test('shows formatted idExpiration when set', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: populatedDocument });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('id-expiration-row')).toHaveTextContent('01/15/2028');
    });
  });

  test('shows Edit button when user has TrusteeAdmin role', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit upcoming key dates/i })).toBeInTheDocument();
    });
  });

  test('does not render Edit button when user lacks TrusteeAdmin role', async () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('ch12-upcoming-key-dates-card')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /edit upcoming key dates/i }),
    ).not.toBeInTheDocument();
  });

  test('Edit button navigates to upcoming-key-dates/edit', async () => {
    const user = TestingUtilities.setupUserEvent();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit upcoming key dates/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /edit upcoming key dates/i }));

    expect(mockNavigate).toHaveBeenCalledWith(
      `/trustees/${defaultProps.trusteeId}/appointments/${defaultProps.appointmentId}/upcoming-key-dates/edit`,
      expect.objectContaining({ state: { subHeading: defaultProps.appointmentHeading } }),
    );
  });
});
