import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import Chapter7PanelAppointmentBody from './Chapter7PanelAppointmentBody';
import Api2 from '@/lib/models/api2';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import * as featureFlagsHook from '@/lib/hooks/UseFeatureFlags';
import { DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES } from '@/lib/hooks/UseFeatureFlags';

vi.mock('./AppointmentBasicFields', () => ({
  default: (props: { appointment: TrusteeAppointment }) => (
    <div data-testid="appointment-basic-fields" data-appointment-id={props.appointment.id} />
  ),
}));

function mockCard(testId: string) {
  return (props: {
    data: TrusteeUpcomingKeyDates | null;
    isLoading: boolean;
    appointmentHeading?: string;
  }) => (
    <div
      data-testid={testId}
      data-is-loading={String(props.isLoading)}
      data-has-data={String(props.data !== null)}
      data-appointment-heading={props.appointmentHeading}
    />
  );
}

vi.mock('./Chapter7PanelAuditFieldExamCard', () => ({
  default: mockCard('chapter7-panel-audit-field-exam-card'),
}));
vi.mock('./Chapter7PanelTrusteePerformanceReportCard', () => ({
  default: mockCard('chapter7-panel-tpr-card'),
}));
vi.mock('./Chapter7PanelTrusteeInterimReportCard', () => ({
  default: mockCard('chapter7-panel-tir-card'),
}));
vi.mock('./Chapter7PanelOtherKeyDatesCard', () => ({
  default: mockCard('chapter7-panel-other-key-dates-card'),
}));

describe('Chapter7PanelAppointmentBody', () => {
  const mockAppointment: TrusteeAppointment = {
    id: 'appointment-003',
    trusteeId: 'trustee-789',
    chapter: '7',
    appointmentType: 'panel',
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
    id: 'key-dates-002',
    documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
    trusteeId: 'trustee-789',
    appointmentId: 'appointment-003',
    createdOn: '2020-01-10T14:30:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2020-01-10T14:30:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    upcomingExamOrAuditYear: 2026,
    upcomingExamOrAuditType: 'Audit',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
      [DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES]: true,
    });
  });

  function renderBody(appointment: TrusteeAppointment = mockAppointment) {
    return render(<Chapter7PanelAppointmentBody appointment={appointment} />);
  }

  test('forwards the appointment prop to AppointmentBasicFields', () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    expect(screen.getByTestId('appointment-basic-fields')).toHaveAttribute(
      'data-appointment-id',
      'appointment-003',
    );
  });

  test('fetches key dates once and forwards the result to all four cards', async () => {
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('chapter7-panel-audit-field-exam-card')).toHaveAttribute(
        'data-is-loading',
        'false',
      );
    });
    expect(getSpy).toHaveBeenCalledWith('trustee-789', 'appointment-003');
    expect(getSpy).toHaveBeenCalledTimes(1);
    for (const testId of [
      'chapter7-panel-audit-field-exam-card',
      'chapter7-panel-tpr-card',
      'chapter7-panel-tir-card',
      'chapter7-panel-other-key-dates-card',
    ]) {
      expect(screen.getByTestId(testId)).toHaveAttribute('data-has-data', 'true');
    }
  });

  test('builds the district/division/chapter/type appointment heading for the two editable cards', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('chapter7-panel-audit-field-exam-card')).toHaveAttribute(
        'data-appointment-heading',
        'Southern District of New York (Manhattan): Chapter 7 - Panel',
      );
    });
    expect(screen.getByTestId('chapter7-panel-tpr-card')).toHaveAttribute(
      'data-appointment-heading',
      'Southern District of New York (Manhattan): Chapter 7 - Panel',
    );
  });

  test('omits the division parenthetical when the appointment has none', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

    renderBody({ ...mockAppointment, courtDivisionName: undefined });

    await waitFor(() => {
      expect(screen.getByTestId('chapter7-panel-audit-field-exam-card')).toHaveAttribute(
        'data-appointment-heading',
        'Southern District of New York: Chapter 7 - Panel',
      );
    });
  });

  test('forwards null data to all four cards when no key dates document exists', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('chapter7-panel-other-key-dates-card')).toHaveAttribute(
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
      expect(screen.getByTestId('alert-chapter7-panel-key-dates-error')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('chapter7-panel-audit-field-exam-card')).not.toBeInTheDocument();
  });

  test('does not fetch or render any card when DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES is disabled', () => {
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
      [DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES]: false,
    });
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates');

    renderBody();

    expect(getSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('chapter7-panel-audit-field-exam-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alert-chapter7-panel-key-dates-error')).not.toBeInTheDocument();
  });
});
