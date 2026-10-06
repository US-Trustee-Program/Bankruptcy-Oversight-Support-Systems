import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import Chapter12And13CaseByCaseAppointmentBody from './Chapter12And13CaseByCaseAppointmentBody';
import Api2 from '@/lib/models/api2';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import * as featureFlagsHook from '@/lib/hooks/UseFeatureFlags';
import { TRUSTEE_APPOINTMENT_ACCORDIONS } from '@/lib/hooks/UseFeatureFlags';

vi.mock('./AppointmentBasicFields', () => ({
  default: (props: { appointment: TrusteeAppointment }) => (
    <div data-testid="appointment-basic-fields" data-appointment-id={props.appointment.id} />
  ),
}));

type AnnualReportCardProps = {
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
  trusteeId?: string;
  appointmentId?: string;
  appointmentHeading?: string;
};

// Props are recorded rather than flattened into data attributes. This body's
// whole job is to fetch once and hand the same document to both cards, and a
// derived boolean like `data !== null` cannot tell one object from another.
const cardProps: Record<string, AnnualReportCardProps[]> = {};

function latestProps(testId: string): AnnualReportCardProps {
  const recorded = cardProps[testId];
  if (!recorded?.length) {
    throw new Error(`${testId} was never rendered`);
  }
  return recorded[recorded.length - 1];
}

// Annual report card records props so we can assert it received the right values.
function stubAnnualCard(testId: string) {
  return (props: AnnualReportCardProps) => {
    cardProps[testId] ??= [];
    cardProps[testId].push(props);
    return <div data-testid={testId} data-is-loading={String(props.isLoading)} />;
  };
}

vi.mock('./AnnualReportKeyDatesCard', () => ({
  default: stubAnnualCard('annual-report-card'),
}));

vi.mock('./TrusteePerformanceReportCard', () => ({
  default: (props: {
    data: TrusteeUpcomingKeyDates | null;
    isLoading: boolean;
    variant: string;
    trusteeId?: string;
    appointmentId?: string;
  }) => (
    <div
      data-testid="tpr-card"
      data-is-loading={String(props.isLoading)}
      data-has-data={String(props.data !== null)}
      data-variant={props.variant}
      data-trustee-id={props.trusteeId}
      data-appointment-id={props.appointmentId}
    />
  ),
}));

describe('Chapter12And13CaseByCaseAppointmentBody', () => {
  const chapter12Appointment: TrusteeAppointment = {
    id: 'appointment-012',
    trusteeId: 'trustee-789',
    chapter: '12',
    appointmentType: 'case-by-case',
    courtDivisionName: 'Manhattan',
    courtId: '0208',
    courtName: 'Southern District of New York',
    status: 'active',
    appointedDate: '2020-01-15T00:00:00.000Z',
    effectiveDate: '2021-06-01T00:00:00.000Z',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  const keyDates: TrusteeUpcomingKeyDates = {
    id: 'key-dates-012',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-789',
    appointmentId: 'appointment-012',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    tprReviewPeriodStart: '1900-04-01',
    tprReviewPeriodEnd: '1900-03-31',
  };

  const CARD_TEST_IDS = ['annual-report-card', 'tpr-card'];

  function mockFlags(overrides: Record<string, boolean> = {}) {
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
      [TRUSTEE_APPOINTMENT_ACCORDIONS]: true,
      ...overrides,
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    for (const testId of Object.keys(cardProps)) {
      delete cardProps[testId];
    }
    mockFlags();
  });

  function renderBody(appointment: TrusteeAppointment = chapter12Appointment) {
    return render(<Chapter12And13CaseByCaseAppointmentBody appointment={appointment} />);
  }

  test('forwards the appointment prop to AppointmentBasicFields', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    expect(screen.getByTestId('appointment-basic-fields')).toHaveAttribute(
      'data-appointment-id',
      'appointment-012',
    );
    await waitFor(() => {
      expect(screen.getByTestId('tpr-card')).toHaveAttribute('data-is-loading', 'false');
    });
  });

  test('fetches key dates once and hands both cards the very same document', async () => {
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('tpr-card')).toHaveAttribute('data-is-loading', 'false');
    });
    expect(getSpy).toHaveBeenCalledExactlyOnceWith('trustee-789', 'appointment-012');

    // Identity, not shape: re-fetching per card, or passing a copy to one of
    // them, is the regression this guards against.
    expect(latestProps('annual-report-card').data).toBe(keyDates);
    expect(screen.getByTestId('tpr-card')).toHaveAttribute('data-has-data', 'true');

    // Each card builds its own edit route from these, so a swap would 404.
    expect(latestProps('annual-report-card').trusteeId).toBe('trustee-789');
    expect(latestProps('annual-report-card').appointmentId).toBe('appointment-012');
    expect(screen.getByTestId('tpr-card')).toHaveAttribute('data-trustee-id', 'trustee-789');
    expect(screen.getByTestId('tpr-card')).toHaveAttribute(
      'data-appointment-id',
      'appointment-012',
    );

    // Annual card receives the computed heading
    expect(latestProps('annual-report-card').appointmentHeading).toBe(
      'Southern District of New York (Manhattan): Chapter 12 - Case by Case',
    );

    expect(screen.getByTestId('tpr-card')).toHaveAttribute(
      'data-variant',
      'chapter12-13-case-by-case',
    );
  });

  test('forwards null data to both cards when no key dates document exists', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('tpr-card')).toHaveAttribute('data-is-loading', 'false');
    });
    expect(latestProps('annual-report-card').data).toBeNull();
    expect(screen.getByTestId('tpr-card')).toHaveAttribute('data-has-data', 'false');
  });

  test('reports the loading state to both cards while the fetch is in flight', () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockImplementation(() => new Promise(() => {}));

    renderBody();

    for (const testId of CARD_TEST_IDS) {
      expect(screen.getByTestId(testId)).toHaveAttribute('data-is-loading', 'true');
    }
  });

  test('shows an error alert instead of the cards when the fetch fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('network error'));

    renderBody();

    await waitFor(() => {
      expect(
        screen.getByTestId(`alert-ch12-13-case-by-case-key-dates-error-${chapter12Appointment.id}`),
      ).toBeInTheDocument();
    });
    for (const testId of CARD_TEST_IDS) {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    }
  });

  test('does not fetch or render the cards when the feature flag is disabled', () => {
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
      [TRUSTEE_APPOINTMENT_ACCORDIONS]: false,
    });
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    expect(getSpy).not.toHaveBeenCalled();
    for (const testId of CARD_TEST_IDS) {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    }
    expect(screen.getByTestId('appointment-basic-fields')).toBeInTheDocument();
  });
});
