import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import TrusteeDetailAuditHistory from './TrusteeDetailAuditHistory';
import Api2 from '@/lib/models/api2';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { TrusteeUpcomingKeyDatesHistory } from '@common/cams/trustee-upcoming-key-dates';
import { TrusteeContactHistory } from '@common/cams/trustees';

function renderComponent(trusteeId = 'trustee-001') {
  return render(
    <BrowserRouter>
      <TrusteeDetailAuditHistory trusteeId={trusteeId} />
    </BrowserRouter>,
  );
}

const baseHistory: Omit<TrusteeUpcomingKeyDatesHistory, 'before' | 'after'> = {
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
    vi.restoreAllMocks();
  });

  test('renders a row for AUDIT_UPCOMING_REPORT_DATES with change type "Upcoming Key Dates"', async () => {
    const history: TrusteeUpcomingKeyDatesHistory = {
      ...baseHistory,
      before: { pastFieldExam: '2026-05-01' },
      after: { pastFieldExam: '2026-06-15' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('change-type-upcoming-key-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('change-type-upcoming-key-dates-0')).toHaveTextContent(
      'Upcoming Key Dates',
    );
  });

  test('shows only changed fields in Previous and New columns — pastFieldExam', async () => {
    const history: TrusteeUpcomingKeyDatesHistory = {
      ...baseHistory,
      before: { pastFieldExam: '2026-05-01' },
      after: { pastFieldExam: '2026-06-15' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('previous-upcoming-key-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-upcoming-key-dates-0')).toHaveTextContent('Field Exam:');
    expect(screen.getByTestId('previous-upcoming-key-dates-0')).toHaveTextContent('05/01/2026');
    expect(screen.getByTestId('new-upcoming-key-dates-0')).toHaveTextContent('Field Exam:');
    expect(screen.getByTestId('new-upcoming-key-dates-0')).toHaveTextContent('06/15/2026');
  });

  test('does not show unrelated fields when only one field changed', async () => {
    const history: TrusteeUpcomingKeyDatesHistory = {
      ...baseHistory,
      before: { pastFieldExam: '2026-05-01' },
      after: { pastFieldExam: '2026-06-15' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('previous-upcoming-key-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-upcoming-key-dates-0')).not.toHaveTextContent('Audit');
    expect(screen.getByTestId('previous-upcoming-key-dates-0')).not.toHaveTextContent(
      'TPR Review Period',
    );
  });

  test('formats pastAudit field as MM/YYYY', async () => {
    const history: TrusteeUpcomingKeyDatesHistory = {
      ...baseHistory,
      before: { pastAudit: '2025-08-01' },
      after: { pastAudit: '2026-08-01' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('previous-upcoming-key-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-upcoming-key-dates-0')).toHaveTextContent('08/2025');
    expect(screen.getByTestId('new-upcoming-key-dates-0')).toHaveTextContent('08/2026');
  });

  test('formats TPR Review Period range field as MM/DD - MM/DD', async () => {
    const history: TrusteeUpcomingKeyDatesHistory = {
      ...baseHistory,
      before: { tprReviewPeriodStart: '1900-04-01', tprReviewPeriodEnd: '1900-03-31' },
      after: { tprReviewPeriodStart: '1900-05-01', tprReviewPeriodEnd: '1900-04-30' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('previous-upcoming-key-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-upcoming-key-dates-0')).toHaveTextContent(
      'TPR Review Period:',
    );
    expect(screen.getByTestId('previous-upcoming-key-dates-0')).toHaveTextContent('04/01 - 03/31');
    expect(screen.getByTestId('new-upcoming-key-dates-0')).toHaveTextContent('05/01 - 04/30');
  });

  test('formats TPR Due field as MM/YYYY', async () => {
    const history: TrusteeUpcomingKeyDatesHistory = {
      ...baseHistory,
      before: { tprDue: '2025-09-01' },
      after: { tprDue: '2026-09-01' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('previous-upcoming-key-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-upcoming-key-dates-0')).toHaveTextContent('TPR Due:');
    expect(screen.getByTestId('previous-upcoming-key-dates-0')).toHaveTextContent('09/2025');
    expect(screen.getByTestId('new-upcoming-key-dates-0')).toHaveTextContent('09/2026');
  });

  test('formats TIR Review Period range field as MM/DD - MM/DD', async () => {
    const history: TrusteeUpcomingKeyDatesHistory = {
      ...baseHistory,
      before: { tirReviewPeriodStart: '1900-06-01', tirReviewPeriodEnd: '1900-05-31' },
      after: { tirReviewPeriodStart: '1900-07-01', tirReviewPeriodEnd: '1900-06-30' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('previous-upcoming-key-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-upcoming-key-dates-0')).toHaveTextContent(
      'TIR Review Period:',
    );
    expect(screen.getByTestId('previous-upcoming-key-dates-0')).toHaveTextContent('06/01 - 05/31');
    expect(screen.getByTestId('new-upcoming-key-dates-0')).toHaveTextContent('07/01 - 06/30');
  });

  test('formats TIR Submission and TIR Review fields as MM/DD', async () => {
    const history: TrusteeUpcomingKeyDatesHistory = {
      ...baseHistory,
      before: { tirSubmission: '1900-10-15', tirReview: '1900-11-01' },
      after: { tirSubmission: '1900-11-15', tirReview: '1900-12-01' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('previous-upcoming-key-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-upcoming-key-dates-0')).toHaveTextContent(
      'TIR Submission:',
    );
    expect(screen.getByTestId('previous-upcoming-key-dates-0')).toHaveTextContent('10/15');
    expect(screen.getByTestId('previous-upcoming-key-dates-0')).toHaveTextContent('TIR Review:');
    expect(screen.getByTestId('previous-upcoming-key-dates-0')).toHaveTextContent('11/01');

    expect(screen.getByTestId('new-upcoming-key-dates-0')).toHaveTextContent('11/15');
    expect(screen.getByTestId('new-upcoming-key-dates-0')).toHaveTextContent('12/01');
  });

  test('shows (none) when before is undefined', async () => {
    const history: TrusteeUpcomingKeyDatesHistory = {
      ...baseHistory,
      before: undefined,
      after: { pastFieldExam: '2026-06-15' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('previous-upcoming-key-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-upcoming-key-dates-0')).toHaveTextContent('(none)');
    expect(screen.getByTestId('new-upcoming-key-dates-0')).toHaveTextContent('06/15/2026');
  });

  test('shows (none) when before is a snapshot with no matching report-date fields', async () => {
    const history: TrusteeUpcomingKeyDatesHistory = {
      ...baseHistory,
      before: {},
      after: { pastFieldExam: '2026-06-15' },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('previous-upcoming-key-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-upcoming-key-dates-0')).toHaveTextContent('(none)');
  });

  test('shows (none) for a cleared field value', async () => {
    const history: TrusteeUpcomingKeyDatesHistory = {
      ...baseHistory,
      before: { pastFieldExam: '2026-05-01' },
      after: { pastFieldExam: undefined },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('new-upcoming-key-dates-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-upcoming-key-dates-0')).toHaveTextContent('05/01/2026');
    expect(screen.getByTestId('new-upcoming-key-dates-0')).toHaveTextContent('(none)');
  });

  test('shows changed-by name and formatted date', async () => {
    const history: TrusteeUpcomingKeyDatesHistory = {
      ...baseHistory,
      before: { pastFieldExam: '2026-05-01' },
      after: { pastFieldExam: '2026-06-15' },
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

const baseInternalContactHistory: Omit<TrusteeContactHistory, 'before' | 'after'> = {
  id: 'history-002',
  documentType: 'AUDIT_INTERNAL_CONTACT',
  trusteeId: 'trustee-001',
  createdBy: SYSTEM_USER_REFERENCE,
  createdOn: '2026-03-01T00:00:00.000Z',
  updatedBy: { id: 'user-001', name: 'Jane Attorney' },
  updatedOn: '2026-03-15T00:00:00.000Z',
};

describe('TrusteeDetailAuditHistory — AUDIT_INTERNAL_CONTACT', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('passes a single phone through when the snapshot has only one', async () => {
    // Per-phone rendering (labels, singular vs. plural container) is
    // FormattedContact's own contract, covered by FormattedContact.test.tsx.
    // This only confirms ShowTrusteeContactHistory passed the phone through.
    const history: TrusteeContactHistory = {
      ...baseInternalContactHistory,
      before: undefined,
      after: {
        address: {
          address1: '1 Main St',
          city: 'Anytown',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
        phones: [{ number: '555-111-2222', type: 'direct' }],
      },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('new-contact-0-phone-number')).toBeInTheDocument();
    });

    expect(screen.getByTestId('new-contact-0-phone-number')).toHaveTextContent('555-111-2222');
  });

  test('renders a populated "before" snapshot, not just "(none)"', async () => {
    const history: TrusteeContactHistory = {
      ...baseInternalContactHistory,
      before: {
        address: {
          address1: '1 Main St',
          city: 'Anytown',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
        phones: [{ number: '555-000-1111', type: 'direct' }],
      },
      after: undefined,
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('previous-contact-0-phone-number')).toBeInTheDocument();
    });

    expect(screen.getByTestId('previous-contact-0-phone-number')).toHaveTextContent('555-000-1111');
    expect(screen.getByText('1 Main St')).toBeInTheDocument();
  });

  test('passes every phone through when the snapshot has more than one', async () => {
    const history: TrusteeContactHistory = {
      ...baseInternalContactHistory,
      before: undefined,
      after: {
        address: {
          address1: '1 Main St',
          city: 'Anytown',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
        phones: [
          { number: '555-111-2222', type: 'direct' },
          { number: '555-333-4444', type: 'personalMobile' },
        ],
      },
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('new-contact-0-phones')).toBeInTheDocument();
    });

    // Per-phone type-label rendering is FormattedContact's own contract, covered by
    // FormattedContact.test.tsx. This only confirms ShowTrusteeContactHistory
    // passed both phones through instead of just the first one.
    const newContact = screen.getByTestId('new-contact-0-phones');
    expect(newContact).toHaveTextContent('555-111-2222');
    expect(newContact).toHaveTextContent('555-333-4444');
  });

  test('falls back to a legacy single phone object for pre-migration snapshots', async () => {
    const legacyAfter = {
      address: {
        address1: '1 Main St',
        city: 'Anytown',
        state: 'NY',
        zipCode: '10001',
        countryCode: 'US',
      },
      phone: { number: '555-999-0000', extension: '42' },
    };
    const history: TrusteeContactHistory = {
      ...baseInternalContactHistory,
      before: undefined,
      after: legacyAfter as unknown as TrusteeContactHistory['after'],
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('new-contact-0-phone-number')).toBeInTheDocument();
    });

    expect(screen.getByTestId('new-contact-0-phone-number')).toHaveTextContent(
      '555-999-0000, ext. 42',
    );
  });

  test('renders "(none)" when the snapshot is undefined', async () => {
    const history: TrusteeContactHistory = {
      ...baseInternalContactHistory,
      before: undefined,
      after: undefined,
    };

    vi.spyOn(Api2, 'getTrusteeHistory').mockResolvedValue({ data: [history] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('new-contact-0-no-contact-info')).toBeInTheDocument();
    });

    expect(screen.getByTestId('new-contact-0-no-contact-info')).toHaveTextContent('(none)');
  });
});
