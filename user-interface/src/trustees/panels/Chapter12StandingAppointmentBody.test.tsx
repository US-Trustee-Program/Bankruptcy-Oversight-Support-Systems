import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import Chapter12StandingAppointmentBody from './Chapter12StandingAppointmentBody';
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

function mockCard(testId: string) {
  return (props: { data: TrusteeUpcomingKeyDates | null; isLoading: boolean }) => (
    <div
      data-testid={testId}
      data-is-loading={String(props.isLoading)}
      data-has-data={String(props.data !== null)}
    />
  );
}

vi.mock('./Chapter12StandingAuditCard', () => ({
  default: mockCard('chapter12-standing-audit-card'),
}));
vi.mock('./TrusteePerformanceReportCard', () => ({
  default: (props: {
    data: TrusteeUpcomingKeyDates | null;
    isLoading: boolean;
    variant: string;
  }) => (
    <div
      data-testid="chapter12-standing-tpr-card"
      data-is-loading={String(props.isLoading)}
      data-has-data={String(props.data !== null)}
      data-variant={props.variant}
    />
  ),
}));
vi.mock('./Chapter12StandingBudgetCard', () => ({
  default: () => <div data-testid="chapter12-standing-budget-card" />,
}));
vi.mock('./Chapter12StandingOtherKeyDatesCard', () => ({
  default: mockCard('chapter12-standing-other-key-dates-card'),
}));

describe('Chapter12StandingAppointmentBody', () => {
  const mockAppointment: TrusteeAppointment = {
    id: 'appointment-004',
    trusteeId: 'trustee-321',
    chapter: '12',
    appointmentType: 'standing',
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
    id: 'key-dates-005',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-321',
    appointmentId: 'appointment-004',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    pastAudit: '2023-02-04',
  };

  beforeEach(() => {
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
      [TRUSTEE_APPOINTMENT_ACCORDIONS]: true,
    });
  });

  function renderBody(appointment: TrusteeAppointment = mockAppointment) {
    return render(<Chapter12StandingAppointmentBody appointment={appointment} />);
  }

  test('forwards the appointment prop to AppointmentBasicFields', () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    expect(screen.getByTestId('appointment-basic-fields')).toHaveAttribute(
      'data-appointment-id',
      'appointment-004',
    );
  });

  test('fetches key dates once and forwards the result to all data-driven cards', async () => {
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('chapter12-standing-audit-card')).toHaveAttribute(
        'data-is-loading',
        'false',
      );
    });
    expect(getSpy).toHaveBeenCalledWith('trustee-321', 'appointment-004');
    expect(getSpy).toHaveBeenCalledTimes(1);
    for (const testId of [
      'chapter12-standing-audit-card',
      'chapter12-standing-tpr-card',
      'chapter12-standing-other-key-dates-card',
    ]) {
      expect(screen.getByTestId(testId)).toHaveAttribute('data-has-data', 'true');
    }
    expect(screen.getByTestId('chapter12-standing-budget-card')).toBeInTheDocument();
    expect(screen.getByTestId('chapter12-standing-tpr-card')).toHaveAttribute(
      'data-variant',
      'chapter12-standing',
    );
  });

  test('forwards null data to all data-driven cards when no key dates document exists', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('chapter12-standing-other-key-dates-card')).toHaveAttribute(
        'data-has-data',
        'false',
      );
    });
  });

  test('shows an error alert instead of the cards when the fetch fails', async () => {
    // useUpcomingKeyDates.test.ts already covers the console.error call this
    // fetch failure triggers; this test only asserts this component's own
    // observable contract (alert shown, cards not rendered).
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('network error'));

    renderBody();

    await waitFor(() => {
      expect(
        screen.getByTestId('alert-chapter12-standing-key-dates-error-appointment-004'),
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId('chapter12-standing-audit-card')).not.toBeInTheDocument();
  });

  test('does not fetch or render any card when TRUSTEE_APPOINTMENT_ACCORDIONS is disabled', () => {
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
      [TRUSTEE_APPOINTMENT_ACCORDIONS]: false,
    });
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates');

    renderBody();

    expect(getSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('chapter12-standing-audit-card')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('alert-chapter12-standing-key-dates-error-appointment-004'),
    ).not.toBeInTheDocument();
  });
});
