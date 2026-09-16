import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import Chapter7ElectedAppointmentBody from './Chapter7ElectedAppointmentBody';
import Api2 from '@/lib/models/api2';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

vi.mock('./AppointmentBasicFields', () => ({
  default: (props: { appointment: TrusteeAppointment }) => (
    <div data-testid="appointment-basic-fields" data-appointment-id={props.appointment.id} />
  ),
}));

vi.mock('./BondKeyDatesCard', () => ({
  default: (props: { data: TrusteeUpcomingKeyDates | null; isLoading: boolean }) => (
    <div
      data-testid="bond-key-dates-card"
      data-is-loading={String(props.isLoading)}
      data-has-data={String(props.data !== null)}
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

  test('forwards null data to BondKeyDatesCard when no key dates document exists', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('bond-key-dates-card')).toHaveAttribute('data-has-data', 'false');
    });
  });

  test('forwards null data to BondKeyDatesCard when the fetch fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchError = new Error('network error');
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(fetchError);

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('bond-key-dates-card')).toHaveAttribute('data-is-loading', 'false');
    });
    expect(screen.getByTestId('bond-key-dates-card')).toHaveAttribute('data-has-data', 'false');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Could not load bond key dates', fetchError);
  });
});
