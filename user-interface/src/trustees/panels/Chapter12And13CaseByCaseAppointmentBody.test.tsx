import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import Chapter12And13CaseByCaseAppointmentBody from './Chapter12And13CaseByCaseAppointmentBody';
import Api2 from '@/lib/models/api2';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import * as featureFlagsHook from '@/lib/hooks/UseFeatureFlags';
import { DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES } from '@/lib/hooks/UseFeatureFlags';

vi.mock('./AppointmentBasicFields', () => ({
  default: (props: { appointment: TrusteeAppointment }) => (
    <div data-testid="appointment-basic-fields" data-appointment-id={props.appointment.id} />
  ),
}));

type StubCardProps = {
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
  trusteeId?: string;
  appointmentId?: string;
  appointmentHeading?: string;
};

// Both themed cards take the same props, so one stub factory keeps the
// assertions symmetrical between them.
function stubCard(testId: string) {
  return (props: StubCardProps) => (
    <div
      data-testid={testId}
      data-is-loading={String(props.isLoading)}
      data-has-data={String(props.data !== null)}
      data-trustee-id={String(props.trusteeId)}
      data-appointment-id={String(props.appointmentId)}
      data-appointment-heading={String(props.appointmentHeading)}
    />
  );
}

vi.mock('./AnnualReportKeyDatesCard', () => ({
  default: stubCard('annual-report-card'),
}));

vi.mock('./TrusteePerformanceReportKeyDatesCard', () => ({
  default: stubCard('tpr-card'),
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

  const chapter13Appointment: TrusteeAppointment = {
    ...chapter12Appointment,
    id: 'appointment-013',
    chapter: '13',
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

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
      [DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES]: true,
    });
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

  test('renders both themed key-dates cards', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('annual-report-card')).toBeInTheDocument();
    });
    expect(screen.getByTestId('tpr-card')).toBeInTheDocument();
  });

  test('fetches key dates once and forwards the same result to both cards', async () => {
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('tpr-card')).toHaveAttribute('data-is-loading', 'false');
    });
    expect(getSpy).toHaveBeenCalledExactlyOnceWith('trustee-789', 'appointment-012');
    for (const testId of CARD_TEST_IDS) {
      const card = screen.getByTestId(testId);
      expect(card).toHaveAttribute('data-has-data', 'true');
      // Each card builds its own edit route from these, so a swap would 404.
      expect(card).toHaveAttribute('data-trustee-id', 'trustee-789');
      expect(card).toHaveAttribute('data-appointment-id', 'appointment-012');
    }
  });

  test.each([
    [chapter12Appointment, 'Southern District of New York (Manhattan): Chapter 12 - Case by Case'],
    [chapter13Appointment, 'Southern District of New York (Manhattan): Chapter 13 - Case by Case'],
  ])('builds the appointment heading for chapter $chapter', async (appointment, expected) => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

    renderBody(appointment);

    await waitFor(() => {
      expect(screen.getByTestId('annual-report-card')).toHaveAttribute(
        'data-appointment-heading',
        expected,
      );
    });
    expect(screen.getByTestId('tpr-card')).toHaveAttribute('data-appointment-heading', expected);
  });

  test('forwards null data to both cards when no key dates document exists', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('annual-report-card')).toHaveAttribute('data-has-data', 'false');
    });
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
      [DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES]: false,
    });
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates');

    renderBody();

    expect(getSpy).not.toHaveBeenCalled();
    for (const testId of CARD_TEST_IDS) {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    }
    expect(screen.getByTestId('appointment-basic-fields')).toBeInTheDocument();
  });
});
