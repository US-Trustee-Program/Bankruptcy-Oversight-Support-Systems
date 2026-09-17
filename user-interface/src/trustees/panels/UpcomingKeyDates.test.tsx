import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import UpcomingKeyDates, { UpcomingKeyDatesProps } from './UpcomingKeyDates';
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
  upcomingExamOrAuditYear: 2029,
  upcomingExamOrAuditType: 'Field Exam',
  tirFrequency: 'ANNUAL',
  lastAuditFiscalYear: 2024,
  tprReviewPeriodStart: '1900-04-01',
  tprReviewPeriodEnd: '1900-03-31',
  tprDue: '1900-09-15',
  tprDueYearType: 'EVEN',
  tprFrequency: 'ANNUAL',
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15'));
    vi.restoreAllMocks();
    mockNavigate.mockClear();
    mockUseNavigate.mockReturnValue(mockNavigate);
    TestingUtilities.setUserWithRoles([CamsRole.TrusteeAdmin]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('renders "No date added" for all fields when data is null', () => {
    renderComponent();

    expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();

    expect(screen.getByTestId('upcoming-exam-audit-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('audit-req-by-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('tpr-review-period-frequency-row')).toHaveTextContent(
      'No frequency selected',
    );
    expect(screen.getByTestId('tpr-due-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('tir-review-period-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('tir-submission-row')).toHaveTextContent('No date added');
    expect(screen.getByTestId('tir-review-row')).toHaveTextContent('No date added');
  });

  test('renders all field labels', () => {
    renderComponent();

    expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();

    expect(screen.getByText('Field Exam / Audit:')).toBeInTheDocument();
    expect(screen.getByText('Audit Required by:')).toBeInTheDocument();
    expect(screen.getByText('Trustee Performance Review Period:')).toBeInTheDocument();
    expect(screen.getByText('TPR Review Period Frequency:')).toBeInTheDocument();
    expect(screen.getByText('Trustee Performance Review Due:')).toBeInTheDocument();
    expect(screen.getByText('TIR Review Period:')).toBeInTheDocument();
    expect(screen.getByText('TIR Submission:')).toBeInTheDocument();
    expect(screen.getByText('TIR Due:')).toBeInTheDocument();
  });

  test('renders correctly formatted values when populated document is provided', () => {
    renderComponent({ data: populatedDocument });

    expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();

    expect(screen.getByTestId('upcoming-exam-audit-row')).toHaveTextContent('2029');
    expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('04/01 - 03/31');
    expect(screen.getByTestId('tpr-review-period-frequency-row')).toHaveTextContent('One year');
    expect(screen.getByTestId('tpr-due-row')).toHaveTextContent('09/15/2026');
    expect(screen.getByTestId('tir-submission-row')).toHaveTextContent('10/15');
    expect(screen.getByTestId('tir-review-row')).toHaveTextContent('11/01');
  });

  test('TPR Review Period shows mm/dd/yyyy - mm/dd/yyyy when full-year dates are stored', () => {
    renderComponent({
      data: {
        ...populatedDocument,
        tprReviewPeriodStart: '2025-04-01',
        tprReviewPeriodEnd: '2026-03-31',
      },
    });

    expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent(
      '04/01/2025 - 03/31/2026',
    );
  });

  test('TPR Due shows correct year for ODD year type on chapter7-panel', () => {
    renderComponent({
      data: { ...populatedDocument, tprDueYearType: 'ODD' },
    });

    // System time pinned to 2026-01-15 (even year) → ODD type → next odd year is 2027
    expect(screen.getByTestId('tpr-due-row')).toHaveTextContent('09/15/2027');
  });

  test('exam/audit row uses type as label when upcomingExamOrAuditType is set', () => {
    renderComponent({ data: populatedDocument });

    expect(screen.getByTestId('upcoming-exam-audit-row')).toBeInTheDocument();

    expect(screen.getByText('Field Exam:')).toBeInTheDocument();
    expect(screen.getByTestId('upcoming-exam-audit-row')).toHaveTextContent('2029');
  });

  test('exam/audit row uses "Field Exam / Audit" label when type is absent', () => {
    renderComponent({
      data: {
        ...populatedDocument,
        upcomingExamOrAuditType: undefined,
        upcomingExamOrAuditYear: undefined,
      },
    });

    expect(screen.getByTestId('upcoming-exam-audit-row')).toBeInTheDocument();

    expect(screen.getByText('Field Exam / Audit:')).toBeInTheDocument();
    expect(screen.getByTestId('upcoming-exam-audit-row')).toHaveTextContent('No date added');
  });

  test('TIR Review Period shows both ranges joined with " & " for semi-annual', () => {
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
    renderComponent({ data: semiAnnualDoc });

    expect(screen.getByTestId('tir-review-period-row')).toHaveTextContent(
      '01/01 - 06/30 & 07/01 - 12/31',
    );
  });

  test('TIR Submission shows both dates joined with " & " for semi-annual', () => {
    const semiAnnualDoc: TrusteeUpcomingKeyDates = {
      ...populatedDocument,
      tirFrequency: 'SEMI_ANNUAL',
      tirSubmission: '1900-10-15',
      tirSemiAnnualSubmission: '1900-04-15',
    };
    renderComponent({ data: semiAnnualDoc });

    expect(screen.getByTestId('tir-submission-row')).toHaveTextContent('10/15 & 04/15');
  });

  test('TIR Due shows both dates joined with " & " for semi-annual', () => {
    const semiAnnualDoc: TrusteeUpcomingKeyDates = {
      ...populatedDocument,
      tirFrequency: 'SEMI_ANNUAL',
      tirReview: '1900-09-28',
      tirSemiAnnualReview: '1900-03-30',
    };
    renderComponent({ data: semiAnnualDoc });

    expect(screen.getByTestId('tir-review-row')).toHaveTextContent('09/28 & 03/30');
  });

  test('renders Audit req by as calculated year when lastAuditFiscalYear is set', () => {
    renderComponent({ data: populatedDocument });

    expect(screen.getByTestId('audit-req-by-row')).toHaveTextContent('2027');
  });

  test('renders Audit req by as No date added when lastAuditFiscalYear is absent', () => {
    renderComponent({ data: { ...populatedDocument, lastAuditFiscalYear: undefined } });

    expect(screen.getByTestId('audit-req-by-row')).toHaveTextContent('No date added');
  });

  test('shows "No date added" for TIR Review Period when only start is defined', () => {
    renderComponent({ data: { ...populatedDocument, tirReviewPeriodEnd: undefined } });

    expect(screen.getByTestId('tir-review-period-row')).toHaveTextContent('No date added');
  });

  test('Edit button is visible for TrusteeAdmin users', () => {
    renderComponent();

    expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /edit upcoming key dates/i })).toBeInTheDocument();
  });

  test('Edit button is not visible for non-TrusteeAdmin users', () => {
    TestingUtilities.setUserWithRoles([CamsRole.CaseAssignmentManager]);

    renderComponent();

    expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: /edit upcoming key dates/i }),
    ).not.toBeInTheDocument();
  });

  test('shows loading spinner while isLoading is true', () => {
    renderComponent({ isLoading: true });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
  });

  test('defaults to chapter7-panel variant when no variant prop is passed', () => {
    render(
      <BrowserRouter>
        <UpcomingKeyDates
          trusteeId={defaultProps.trusteeId}
          appointmentId={defaultProps.appointmentId}
          data={populatedDocument}
          isLoading={false}
        />
      </BrowserRouter>,
    );

    expect(screen.getByTestId('upcoming-key-dates-card')).toBeInTheDocument();

    expect(screen.getByTestId('upcoming-exam-audit-row')).toBeInTheDocument();
    expect(screen.getByTestId('tir-review-row')).toBeInTheDocument();
  });

  describe('chapter12-standing variant', () => {
    const ch12StandingProps: UpcomingKeyDatesProps = {
      ...defaultProps,
      variant: 'chapter12-standing',
      trusteeId: 'trustee-ch12-001',
      appointmentId: 'appointment-ch12-001',
      appointmentHeading: 'Southern District of New York (Manhattan) - Chapter 12 Standing',
    };

    const ch12StandingDoc: TrusteeUpcomingKeyDates = {
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

    test('renders "No date added" for computed fields when data is null', () => {
      renderComponent({ ...ch12StandingProps, data: null });

      expect(screen.getByTestId('audit-req-by-row')).toHaveTextContent('No date added');
      expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('No date added');
      expect(screen.getByTestId('tpr-due-row')).toHaveTextContent('No date added');
      expect(screen.getByTestId('lease-expiration-row')).toHaveTextContent('No date added');
      expect(screen.getByTestId('id-expiration-row')).toHaveTextContent('No date added');
    });

    test.each([
      ['audit-req-by-row', '2025'],
      ['tpr-review-period-row', '01/01 - 12/31'],
      ['tpr-due-row', '03/15/2027'],
      ['lease-expiration-row', '06/30/2027'],
      ['id-expiration-row', '01/15/2028'],
    ])('shows formatted value for %s when data is populated', (testId, expectedValue) => {
      renderComponent({ ...ch12StandingProps, data: ch12StandingDoc });

      expect(screen.getByTestId(testId)).toHaveTextContent(expectedValue);
    });

    test.each([
      ['annual-report-due-row', '09/30'],
      ['budget-submission-due-row', '05/01'],
      ['budget-review-to-oo-row', '06/01'],
    ])('constant row %s always shows %s', (testId, expectedValue) => {
      renderComponent({ ...ch12StandingProps, data: null });

      expect(screen.getByTestId(testId)).toHaveTextContent(expectedValue);
    });

    test('displays "Audit Recommended by" (not "Audit Req. By") as field label', () => {
      renderComponent({ ...ch12StandingProps, data: null });

      expect(screen.getByText('Audit Recommended by:')).toBeInTheDocument();
    });

    test('displays "Budget Due to OO" (not "Budget Review to OO") as field label', () => {
      renderComponent({ ...ch12StandingProps, data: null });

      expect(screen.getByText('Budget Due to OO:')).toBeInTheDocument();
    });

    test('Edit button navigates with chapter12-standing variant', () => {
      renderComponent(ch12StandingProps);

      screen.getByRole('button', { name: /edit upcoming key dates/i }).click();

      expect(mockNavigate).toHaveBeenCalledWith(
        `/trustees/${ch12StandingProps.trusteeId}/appointments/${ch12StandingProps.appointmentId}/upcoming-key-dates/edit`,
        {
          state: {
            subHeading: ch12StandingProps.appointmentHeading,
            variant: 'chapter12-standing',
          },
        },
      );
    });
  });

  describe('chapter13-standing variant', () => {
    const ch13StandingProps: UpcomingKeyDatesProps = {
      ...defaultProps,
      variant: 'chapter13-standing',
      trusteeId: 'trustee-ch13-001',
      appointmentId: 'appointment-ch13-001',
      appointmentHeading: 'Southern District of New York (Manhattan) - Chapter 13 Standing',
    };

    const ch13StandingDoc: TrusteeUpcomingKeyDates = {
      id: 'doc-ch13-001',
      documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
      trusteeId: 'trustee-ch13-001',
      appointmentId: 'appointment-ch13-001',
      createdBy: SYSTEM_USER_REFERENCE,
      createdOn: '2026-01-01T00:00:00.000Z',
      updatedBy: SYSTEM_USER_REFERENCE,
      updatedOn: '2026-01-01T00:00:00.000Z',
      tprReviewPeriodStart: '1900-01-01',
      tprReviewPeriodEnd: '1900-12-31',
      tprDue: '1900-03-15',
      tprDueYearType: 'ODD',
      leaseExpiration: '2027-06-30',
      idExpiration: '2028-01-15',
    };

    test('renders "No date added" for computed fields when data is null', () => {
      renderComponent({ ...ch13StandingProps, data: null });

      expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('No date added');
      expect(screen.getByTestId('tpr-due-row')).toHaveTextContent('No date added');
      expect(screen.getByTestId('lease-expiration-row')).toHaveTextContent('No date added');
      expect(screen.getByTestId('id-expiration-row')).toHaveTextContent('No date added');
    });

    test.each([
      ['tpr-review-period-row', '01/01 - 12/31'],
      ['tpr-due-row', '03/15/2027'],
      ['lease-expiration-row', '06/30/2027'],
      ['id-expiration-row', '01/15/2028'],
    ])('shows formatted value for %s when data is populated', (testId, expectedValue) => {
      renderComponent({ ...ch13StandingProps, data: ch13StandingDoc });

      expect(screen.getByTestId(testId)).toHaveTextContent(expectedValue);
    });

    test('uses chapter13-specific label text for TPR fields', () => {
      renderComponent({ ...ch13StandingProps, data: null });

      expect(screen.getByText('TPR Review Period:')).toBeInTheDocument();
      expect(screen.getByText('TPR Due:')).toBeInTheDocument();
    });

    test.each([
      ['annual-audit-review-period-row', '10/01 - 09/30'],
      ['budget-submission-due-row', '07/01'],
      ['budget-review-to-oo-row', '08/15'],
    ])('constant row %s always shows %s', (testId, expectedValue) => {
      renderComponent({ ...ch13StandingProps, data: null });

      expect(screen.getByTestId(testId)).toHaveTextContent(expectedValue);
    });
  });

  describe('ch12-13-case-by-case variant', () => {
    test('renders constant fields always showing 09/01 and 09/15 and computed TPR fields', () => {
      renderComponent({ variant: 'ch12-13-case-by-case', data: populatedDocument });

      expect(screen.getByTestId('annual-report-submission-row')).toHaveTextContent('09/01');
      expect(screen.getByTestId('annual-report-due-oo-row')).toHaveTextContent('09/15');
      expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('04/01 - 03/31');
      expect(screen.getByTestId('tpr-due-row')).toHaveTextContent('09/15/2026');
    });

    test('renders constant fields the same even when no key-dates document exists', () => {
      renderComponent({ variant: 'ch12-13-case-by-case', data: null });

      expect(screen.getByTestId('annual-report-submission-row')).toHaveTextContent('09/01');
      expect(screen.getByTestId('annual-report-due-oo-row')).toHaveTextContent('09/15');
      expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('No date added');
      expect(screen.getByTestId('tpr-due-row')).toHaveTextContent('No date added');
    });
  });

  test('Edit button navigates to edit route', () => {
    renderComponent();

    screen.getByRole('button', { name: /edit upcoming key dates/i }).click();

    expect(mockNavigate).toHaveBeenCalledWith(
      `/trustees/${defaultProps.trusteeId}/appointments/${defaultProps.appointmentId}/upcoming-key-dates/edit`,
      { state: { subHeading: defaultProps.appointmentHeading, variant: 'chapter7-panel' } },
    );
  });

  describe('tprDisplayUpdates=false (flag OFF) behavior', () => {
    test('does not render tpr-review-period-frequency-row when tprDisplayUpdates is false', () => {
      renderComponent({ tprDisplayUpdates: false, data: populatedDocument });

      expect(screen.queryByTestId('tpr-review-period-frequency-row')).not.toBeInTheDocument();
    });

    test('tprDue shows "mm/dd YEARTYPE" format when tprDisplayUpdates is false', () => {
      renderComponent({
        tprDisplayUpdates: false,
        data: { ...populatedDocument, tprDue: '1900-09-15', tprDueYearType: 'EVEN' },
      });

      expect(screen.getByTestId('tpr-due-row')).toHaveTextContent('09/15 EVEN');
    });

    test('tprReviewPeriod shows mm/dd - mm/dd even for full-year dates when tprDisplayUpdates is false', () => {
      renderComponent({
        tprDisplayUpdates: false,
        data: {
          ...populatedDocument,
          tprReviewPeriodStart: '2025-04-01',
          tprReviewPeriodEnd: '2026-03-31',
        },
      });

      expect(screen.getByTestId('tpr-review-period-row')).toHaveTextContent('04/01 - 03/31');
    });
  });
});
