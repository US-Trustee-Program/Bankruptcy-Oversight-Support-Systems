import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import Chapter11SubchapterVAppointmentBody from './Chapter11SubchapterVAppointmentBody';
import Api2 from '@/lib/models/api2';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import * as featureFlagsHook from '@/lib/hooks/UseFeatureFlags';
import { DISPLAY_CHPT11_SUBV_PAST_KEY_DATES } from '@/lib/hooks/UseFeatureFlags';

vi.mock('./AppointmentBasicFields', () => ({
  default: (props: { appointment: TrusteeAppointment }) => (
    <div data-testid="appointment-basic-fields" data-appointment-id={props.appointment.id} />
  ),
}));

vi.mock('./PastKeyDates', () => ({
  default: (props: {
    variant?: string;
    data: TrusteeUpcomingKeyDates | null;
    isLoading: boolean;
    trusteeId?: string;
    appointmentId?: string;
    appointmentHeading?: string;
  }) => (
    <div
      data-testid="past-key-dates-card"
      data-variant={String(props.variant)}
      data-is-loading={String(props.isLoading)}
      data-has-data={String(props.data !== null)}
      data-trustee-id={String(props.trusteeId)}
      data-appointment-id={String(props.appointmentId)}
      data-appointment-heading={String(props.appointmentHeading)}
    />
  ),
}));

describe('Chapter11SubchapterVAppointmentBody', () => {
  const mockPoolAppointment: TrusteeAppointment = {
    id: 'appointment-003',
    trusteeId: 'trustee-789',
    chapter: '11-subchapter-v',
    appointmentType: 'pool',
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

  const mockOutOfPoolAppointment: TrusteeAppointment = {
    ...mockPoolAppointment,
    id: 'appointment-004',
    appointmentType: 'out-of-pool',
    status: 'resigned',
  };

  const keyDates: TrusteeUpcomingKeyDates = {
    id: 'key-dates-002',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-789',
    appointmentId: 'appointment-003',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    lastMonthlyReportReceived: '2024-11-15',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
      [DISPLAY_CHPT11_SUBV_PAST_KEY_DATES]: true,
    });
  });

  function renderBody(appointment: TrusteeAppointment = mockPoolAppointment) {
    return render(<Chapter11SubchapterVAppointmentBody appointment={appointment} />);
  }

  test('forwards the appointment prop to AppointmentBasicFields', () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    expect(screen.getByTestId('appointment-basic-fields')).toHaveAttribute(
      'data-appointment-id',
      'appointment-003',
    );
  });

  test('fetches key dates for a pool appointment and forwards the result to PastKeyDates', async () => {
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('past-key-dates-card')).toHaveAttribute('data-is-loading', 'false');
    });
    expect(getSpy).toHaveBeenCalledWith('trustee-789', 'appointment-003');
    expect(screen.getByTestId('past-key-dates-card')).toHaveAttribute('data-variant', 'subv-pool');
    expect(screen.getByTestId('past-key-dates-card')).toHaveAttribute('data-has-data', 'true');
  });

  test('builds the district/division/chapter appointment heading for PastKeyDates, without the appointment type suffix', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('past-key-dates-card')).toHaveAttribute(
        'data-appointment-heading',
        'Southern District of New York (Manhattan): Chapter 11 Subchapter V',
      );
    });
  });

  test('forwards null data to PastKeyDates when no key dates document exists', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('past-key-dates-card')).toHaveAttribute('data-has-data', 'false');
    });
  });

  test('shows an error alert instead of the PastKeyDates card when the fetch fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchError = new Error('network error');
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(fetchError);

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('alert-subv-past-key-dates-error')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('past-key-dates-card')).not.toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Could not load upcoming key dates', fetchError);
  });

  test('does not fetch or render the PastKeyDates card when DISPLAY_CHPT11_SUBV_PAST_KEY_DATES is disabled', () => {
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
      [DISPLAY_CHPT11_SUBV_PAST_KEY_DATES]: false,
    });
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates');

    renderBody();

    expect(getSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('past-key-dates-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alert-subv-past-key-dates-error')).not.toBeInTheDocument();
  });

  test('does not fetch or render the PastKeyDates card for an out-of-pool appointment, even when the flag is enabled', () => {
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates');

    renderBody(mockOutOfPoolAppointment);

    expect(getSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('past-key-dates-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alert-subv-past-key-dates-error')).not.toBeInTheDocument();
  });

  test('still renders AppointmentBasicFields for an out-of-pool appointment', () => {
    renderBody(mockOutOfPoolAppointment);

    expect(screen.getByTestId('appointment-basic-fields')).toHaveAttribute(
      'data-appointment-id',
      'appointment-004',
    );
  });
});
