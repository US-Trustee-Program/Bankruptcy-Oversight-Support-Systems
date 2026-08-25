import { render, screen, within } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import PastKeyDates, { PastKeyDatesProps } from './PastKeyDates';
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
  variant: 'chapter7-panel',
  trusteeId: 'trustee-001',
  appointmentId: 'appointment-001',
  appointmentHeading: 'Southern District of New York (Manhattan) - Chapter 7 Panel',
  data: null,
  isLoading: false,
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
  lastAuditFiscalYear: 2022,
  tprReviewPeriodStart: '1900-04-01',
  tprReviewPeriodEnd: '1900-03-31',
  tprDue: '2026-09-01',
  tirReviewPeriodStart: '1900-07-01',
  tirReviewPeriodEnd: '1900-06-30',
  tirSubmission: '1900-10-15',
  tirReview: '1900-11-01',
};

function renderComponent(props?: Partial<PastKeyDatesProps>) {
  return render(
    <BrowserRouter>
      <PastKeyDates {...defaultProps} {...props} />
    </BrowserRouter>,
  );
}

describe('PastKeyDates', () => {
  let mockNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate = vi.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
  });

  test('renders "No date added" for all fields when data is null', () => {
    renderComponent();

    const noDateElements = screen.getAllByText('No date added');
    expect(noDateElements.length).toBe(5);
  });

  test('renders all field labels', () => {
    renderComponent();

    expect(screen.getByText('Last Update to Background Questionnaire:')).toBeInTheDocument();
    expect(screen.getByText('Field Exam Report Date:')).toBeInTheDocument();
    expect(screen.getByText('Audit Report Date:')).toBeInTheDocument();
    expect(screen.getByText("Last Audit's Fiscal Year:")).toBeInTheDocument();
    expect(screen.getByText('TIR Letter:')).toBeInTheDocument();
  });

  test('renders correctly formatted values when populated document is provided', () => {
    renderComponent({ data: populatedDocument });

    expect(screen.getByTestId('past-background-question-row')).toHaveTextContent('05/10/2022');
    expect(screen.getByTestId('past-field-exam-row')).toHaveTextContent('02/21/2024');
    expect(screen.getByTestId('past-audit-row')).toHaveTextContent('02/22/2023');
    expect(screen.getByTestId('past-tpr-submission-row')).toHaveTextContent('11/03/2025');
  });

  test('renders "No date added" for background question and tpr submission when absent', () => {
    const docWithoutNewFields: TrusteeUpcomingKeyDates = {
      ...populatedDocument,
      pastBackgroundQuestion: undefined,
      pastTprSubmission: undefined,
    };
    renderComponent({ data: docWithoutNewFields });

    expect(screen.getByTestId('past-background-question-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('past-tpr-submission-row')).toHaveTextContent('No date added');
  });

  test('renders fields in correct order', () => {
    renderComponent({ data: populatedDocument });

    expect(screen.getByTestId('past-key-dates-list')).toBeInTheDocument();

    // Assert relative DOM order via the rows' own testIds (PastKeyDates' actual
    // contract), rather than assuming InfoCard renders each row as an <li>.
    const expectedOrder = [
      'past-background-question-row',
      'past-field-exam-row',
      'past-audit-row',
      'past-last-audit-fiscal-year-row',
      'past-tpr-submission-row',
    ];
    const rows = expectedOrder.map((testId) => screen.getByTestId(testId));
    for (let i = 0; i < rows.length - 1; i++) {
      expect(
        rows[i].compareDocumentPosition(rows[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  test('Edit button is visible for TrusteeAdmin users', () => {
    renderComponent();

    expect(screen.getByRole('button', { name: /edit past key dates/i })).toBeInTheDocument();
  });

  test('Edit button is not visible for non-TrusteeAdmin users', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    renderComponent();

    expect(screen.queryByRole('button', { name: /edit past key dates/i })).not.toBeInTheDocument();
  });

  test('shows loading spinner while isLoading is true', () => {
    renderComponent({ isLoading: true });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('past-key-dates-card')).not.toBeInTheDocument();
  });

  test('renders Last Audit Fiscal Year value when present', () => {
    renderComponent({ data: populatedDocument });

    expect(screen.getByTestId('past-last-audit-fiscal-year-row')).toHaveTextContent('2022');
  });

  test('renders Last Audit Fiscal Year as No date added when absent', () => {
    renderComponent({ data: { ...populatedDocument, lastAuditFiscalYear: undefined } });

    expect(screen.getByTestId('past-last-audit-fiscal-year-row')).toHaveTextContent(
      'No date added',
    );
  });

  test('Edit button navigates to edit route', () => {
    renderComponent();

    screen.getByRole('button', { name: /edit past key dates/i }).click();

    expect(mockNavigate).toHaveBeenCalledWith(
      `/trustees/${defaultProps.trusteeId}/appointments/${defaultProps.appointmentId}/past-key-dates/edit`,
      { state: { subHeading: defaultProps.appointmentHeading, variant: 'chapter7-panel' } },
    );
  });

  test('Edit button navigates with empty subHeading when appointmentHeading is undefined', () => {
    renderComponent({ appointmentHeading: undefined });

    screen.getByRole('button', { name: /edit past key dates/i }).click();

    expect(mockNavigate).toHaveBeenCalledWith(
      `/trustees/${defaultProps.trusteeId}/appointments/${defaultProps.appointmentId}/past-key-dates/edit`,
      { state: { subHeading: '', variant: 'chapter7-panel' } },
    );
  });

  describe('subv-pool variant', () => {
    const subVProps: PastKeyDatesProps = {
      variant: 'subv-pool',
      trusteeId: 'trustee-001',
      appointmentId: 'appointment-001',
      appointmentHeading:
        'Southern District of New York (Manhattan) - Chapter 11 Subchapter V Pool',
      data: null,
      isLoading: false,
    };

    test('renders exactly one row: Last Monthly Report Received', () => {
      renderComponent(subVProps);

      // Assert via PastKeyDates' own testId contract (which fields it renders),
      // not InfoCard's internal markup — none of the chapter7-panel-only rows
      // should be present alongside the single subv-pool row.
      expect(screen.getByTestId('past-last-monthly-report-received-row')).toBeInTheDocument();
      expect(screen.queryByTestId('past-background-question-row')).not.toBeInTheDocument();
      expect(screen.queryByTestId('past-field-exam-row')).not.toBeInTheDocument();
      expect(screen.queryByTestId('past-audit-row')).not.toBeInTheDocument();
      expect(screen.queryByTestId('past-last-audit-fiscal-year-row')).not.toBeInTheDocument();
      expect(screen.queryByTestId('past-tpr-submission-row')).not.toBeInTheDocument();
      expect(screen.getByText('Last Monthly Report Received:')).toBeInTheDocument();
    });

    test('renders Last Monthly Report Received value stacked below its label', () => {
      renderComponent(subVProps);

      const row = screen.getByTestId('past-last-monthly-report-received-row');
      const { getByText } = within(row);
      const valueNode = getByText('No date added');
      expect(valueNode.closest('.info-card-value-stacked')).not.toBeNull();
    });

    test('renders "No date added" when lastMonthlyReportReceived is absent', () => {
      renderComponent(subVProps);

      expect(screen.getByTestId('past-last-monthly-report-received-row')).toHaveTextContent(
        'No date added',
      );
    });

    test('renders the saved date when lastMonthlyReportReceived is present', () => {
      renderComponent({
        ...subVProps,
        data: { ...populatedDocument, lastMonthlyReportReceived: '2024-11-15' },
      });

      expect(screen.getByTestId('past-last-monthly-report-received-row')).toHaveTextContent(
        '11/15/2024',
      );
    });

    test('row still renders when user cannot manage', () => {
      TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

      renderComponent(subVProps);

      expect(screen.getByTestId('past-last-monthly-report-received-row')).toBeInTheDocument();
    });
  });

  describe('chapter12-standing variant', () => {
    const ch12StandingProps: PastKeyDatesProps = {
      variant: 'chapter12-standing',
      trusteeId: 'trustee-ch12-001',
      appointmentId: 'appointment-ch12-001',
      appointmentHeading: 'Southern District of New York (Manhattan) - Chapter 12 Standing',
      data: null,
      isLoading: false,
    };

    const ch12StandingDoc: TrusteeUpcomingKeyDates = {
      ...populatedDocument,
      trusteeId: 'trustee-ch12-001',
      appointmentId: 'appointment-ch12-001',
      pastBackgroundQuestion: '2023-03-15',
      pastAudit: '2024-08-20',
      lastAuditFiscalYear: 2023,
    };

    test('renders the 3 chapter12-standing fields and not the ch7-only fields', () => {
      renderComponent(ch12StandingProps);

      expect(screen.getByTestId('past-background-question-row')).toBeInTheDocument();
      expect(screen.getByTestId('past-audit-row')).toBeInTheDocument();
      expect(screen.getByTestId('past-last-audit-fiscal-year-row')).toBeInTheDocument();

      expect(screen.queryByTestId('past-field-exam-row')).not.toBeInTheDocument();
      expect(screen.queryByTestId('past-tpr-submission-row')).not.toBeInTheDocument();
      expect(screen.queryByTestId('past-last-monthly-report-received-row')).not.toBeInTheDocument();
    });

    test('renders "No date added" for computed fields when data is null', () => {
      renderComponent(ch12StandingProps);

      expect(screen.getByTestId('past-background-question-row')).toHaveTextContent('No date added');
      expect(screen.getByTestId('past-audit-row')).toHaveTextContent('No date added');
      expect(screen.getByTestId('past-last-audit-fiscal-year-row')).toHaveTextContent(
        'No date added',
      );
    });

    test('renders formatted values when data is populated', () => {
      renderComponent({ ...ch12StandingProps, data: ch12StandingDoc });

      expect(screen.getByTestId('past-background-question-row')).toHaveTextContent('03/15/2023');
      expect(screen.getByTestId('past-audit-row')).toHaveTextContent('08/20/2024');
      expect(screen.getByTestId('past-last-audit-fiscal-year-row')).toHaveTextContent('2023');
    });

    test('Edit button navigates with chapter12-standing variant', () => {
      renderComponent(ch12StandingProps);

      screen.getByRole('button', { name: /edit past key dates/i }).click();

      expect(mockNavigate).toHaveBeenCalledWith(
        `/trustees/${ch12StandingProps.trusteeId}/appointments/${ch12StandingProps.appointmentId}/past-key-dates/edit`,
        {
          state: {
            subHeading: ch12StandingProps.appointmentHeading,
            variant: 'chapter12-standing',
          },
        },
      );
    });
  });
});
