import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import Chapter7ElectedAppointmentBody from './Chapter7ElectedAppointmentBody';
import Api2 from '@/lib/models/api2';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import * as featureFlagsHook from '@/lib/hooks/UseFeatureFlags';
import { DISPLAY_CHPT7_ELECTED_KEY_DATES } from '@/lib/hooks/UseFeatureFlags';

vi.mock('./AppointmentBasicFields', () => ({
  default: (props: { appointment: TrusteeAppointment }) => (
    <div data-testid="appointment-basic-fields" data-appointment-id={props.appointment.id} />
  ),
}));

vi.mock('./BondKeyDatesCard', () => ({
  default: (props: {
    data: TrusteeUpcomingKeyDates | null;
    isLoading: boolean;
    appointmentHeading?: string;
  }) => (
    <div
      data-testid="bond-key-dates-card"
      data-is-loading={String(props.isLoading)}
      data-has-data={String(props.data !== null)}
      data-appointment-heading={props.appointmentHeading}
    />
  ),
}));

describe('Chapter7ElectedAppointmentBody', () => {
  const mockAppointment: TrusteeAppointment = {
    id: 'appointment-002',
    trusteeId: 'trustee-456',
    chapter: '7',
    appointmentType: 'elected',
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
    id: 'key-dates-001',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-456',
    appointmentId: 'appointment-002',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    bondIssuedDate: '2023-06-01',
    bondRenewalDate: '2026-06-01',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
      [DISPLAY_CHPT7_ELECTED_KEY_DATES]: true,
    });
  });

  function renderBody(appointment: TrusteeAppointment = mockAppointment) {
    return render(<Chapter7ElectedAppointmentBody appointment={appointment} />);
  }

  test('forwards the appointment prop to AppointmentBasicFields', () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    expect(screen.getByTestId('appointment-basic-fields')).toHaveAttribute(
      'data-appointment-id',
      'appointment-002',
    );
  });

  test('fetches key dates for this appointment and forwards the result to BondKeyDatesCard', async () => {
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('bond-key-dates-card')).toHaveAttribute('data-is-loading', 'false');
    });
    expect(getSpy).toHaveBeenCalledWith('trustee-456', 'appointment-002');
    expect(screen.getByTestId('bond-key-dates-card')).toHaveAttribute('data-has-data', 'true');
  });

  test('builds the district/division/chapter/type appointment heading for BondKeyDatesCard', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('bond-key-dates-card')).toHaveAttribute(
        'data-appointment-heading',
        'Southern District of New York (Manhattan): Chapter 7 - Elected',
      );
    });
  });

  test('omits the division parenthetical when the appointment has none', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

    renderBody({ ...mockAppointment, courtDivisionName: undefined });

    await waitFor(() => {
      expect(screen.getByTestId('bond-key-dates-card')).toHaveAttribute(
        'data-appointment-heading',
        'Southern District of New York: Chapter 7 - Elected',
      );
    });
  });

  test('forwards null data to BondKeyDatesCard when no key dates document exists', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('bond-key-dates-card')).toHaveAttribute('data-has-data', 'false');
    });
  });

  test('shows an error alert instead of the Bond card when the fetch fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchError = new Error('network error');
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(fetchError);

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('alert-bond-key-dates-error-appointment-002')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('bond-key-dates-card')).not.toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Could not load upcoming key dates', fetchError);
  });

  test('does not fetch or render the Bond card when DISPLAY_CHPT7_ELECTED_KEY_DATES is disabled', () => {
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
      [DISPLAY_CHPT7_ELECTED_KEY_DATES]: false,
    });
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates');

    renderBody();

    expect(getSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('bond-key-dates-card')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('alert-bond-key-dates-error-appointment-002'),
    ).not.toBeInTheDocument();
  });
});
