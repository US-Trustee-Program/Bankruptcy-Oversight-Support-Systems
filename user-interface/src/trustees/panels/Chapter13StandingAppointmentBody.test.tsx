import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import Chapter13StandingAppointmentBody from './Chapter13StandingAppointmentBody';
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

vi.mock('./Chapter13StandingAuditCard', () => ({
  default: mockCard('chapter13-standing-audit-card'),
}));
vi.mock('./TrusteePerformanceReportCard', () => ({
  default: (props: {
    data: TrusteeUpcomingKeyDates | null;
    isLoading: boolean;
    variant: string;
  }) => (
    <div
      data-testid="chapter13-standing-tpr-card"
      data-is-loading={String(props.isLoading)}
      data-has-data={String(props.data !== null)}
      data-variant={props.variant}
    />
  ),
}));
vi.mock('./StandingBudgetCard', () => ({
  default: (props: { variant: string }) => (
    <div data-testid="chapter13-standing-budget-card" data-variant={props.variant} />
  ),
}));
vi.mock('./Chapter13StandingOtherCard', () => ({
  default: mockCard('chapter13-standing-other-card'),
}));

describe('Chapter13StandingAppointmentBody', () => {
  const mockAppointment: TrusteeAppointment = {
    id: 'appointment-001',
    trusteeId: 'trustee-123',
    chapter: '13',
    appointmentType: 'standing',
    courtDivisionName: 'Manhattan',
    courtId: '0208',
    courtName: 'Southern District of New York',
    divisionCode: '081',
    status: 'active',
    appointedDate: '2020-01-15T00:00:00.000Z',
    effectiveDate: '2020-01-15T00:00:00.000Z',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  const keyDates: TrusteeUpcomingKeyDates = {
    id: 'key-dates-001',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-123',
    appointmentId: 'appointment-001',
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
    return render(<Chapter13StandingAppointmentBody appointment={appointment} />);
  }

  test('forwards the appointment prop to AppointmentBasicFields', () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    expect(screen.getByTestId('appointment-basic-fields')).toHaveAttribute(
      'data-appointment-id',
      'appointment-001',
    );
  });

  test('passes isLoading through to each data-driven card while key dates are loading', () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockImplementation(() => new Promise(() => {}));

    renderBody();

    expect(screen.getByTestId('chapter13-standing-cards-stack')).toBeInTheDocument();
    for (const testId of [
      'chapter13-standing-audit-card',
      'chapter13-standing-tpr-card',
      'chapter13-standing-other-card',
    ]) {
      expect(screen.getByTestId(testId)).toHaveAttribute('data-is-loading', 'true');
    }
  });

  test('fetches key dates once and forwards the result to all data-driven cards', async () => {
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('chapter13-standing-audit-card')).toHaveAttribute(
        'data-is-loading',
        'false',
      );
    });
    expect(getSpy).toHaveBeenCalledWith('trustee-123', 'appointment-001');
    expect(getSpy).toHaveBeenCalledTimes(1);
    for (const testId of [
      'chapter13-standing-audit-card',
      'chapter13-standing-tpr-card',
      'chapter13-standing-other-card',
    ]) {
      expect(screen.getByTestId(testId)).toHaveAttribute('data-has-data', 'true');
    }
    expect(screen.getByTestId('chapter13-standing-budget-card')).toHaveAttribute(
      'data-variant',
      'chapter13-standing',
    );
    expect(screen.getByTestId('chapter13-standing-tpr-card')).toHaveAttribute(
      'data-variant',
      'chapter13-standing',
    );
  });

  test('forwards null data to all data-driven cards when no key dates document exists', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('chapter13-standing-other-card')).toHaveAttribute(
        'data-has-data',
        'false',
      );
    });
  });

  test('shows an error alert instead of the cards when the fetch fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('network error'));

    renderBody();

    await waitFor(() => {
      expect(
        screen.getByTestId('alert-chapter13-standing-key-dates-error-appointment-001'),
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId('chapter13-standing-audit-card')).not.toBeInTheDocument();
  });

  test('does not fetch or render any card when TRUSTEE_APPOINTMENT_ACCORDIONS is disabled', () => {
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
      [TRUSTEE_APPOINTMENT_ACCORDIONS]: false,
    });
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates');

    renderBody();

    expect(getSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('chapter13-standing-audit-card')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('alert-chapter13-standing-key-dates-error-appointment-001'),
    ).not.toBeInTheDocument();
  });
});
