import { render, screen, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import Chapter12And13CaseByCaseAppointmentBody from './Chapter12And13CaseByCaseAppointmentBody';
import Api2 from '@/lib/models/api2';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import * as featureFlagsHook from '@/lib/hooks/UseFeatureFlags';
import {
  DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES,
  TPR_DISPLAY_UPDATES,
} from '@/lib/hooks/UseFeatureFlags';

vi.mock('./AppointmentBasicFields', () => ({
  default: (props: { appointment: TrusteeAppointment }) => (
    <div data-testid="appointment-basic-fields" data-appointment-id={props.appointment.id} />
  ),
}));

vi.mock('./UpcomingKeyDates', () => ({
  default: (props: {
    variant?: string;
    data: TrusteeUpcomingKeyDates | null;
    isLoading: boolean;
    trusteeId?: string;
    appointmentId?: string;
    appointmentHeading?: string;
    tprDisplayUpdates?: boolean;
  }) => (
    <div
      data-testid="upcoming-key-dates-card"
      data-variant={String(props.variant)}
      data-is-loading={String(props.isLoading)}
      data-has-data={String(props.data !== null)}
      data-trustee-id={String(props.trusteeId)}
      data-appointment-id={String(props.appointmentId)}
      data-appointment-heading={String(props.appointmentHeading)}
      data-tpr-display-updates={String(props.tprDisplayUpdates)}
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

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
      [DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES]: true,
      [TPR_DISPLAY_UPDATES]: true,
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
      expect(screen.getByTestId('upcoming-key-dates-card')).toHaveAttribute(
        'data-is-loading',
        'false',
      );
    });
  });

  test('fetches key dates and forwards the result to the UpcomingKeyDates card', async () => {
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-key-dates-card')).toHaveAttribute(
        'data-is-loading',
        'false',
      );
    });
    expect(getSpy).toHaveBeenCalledWith('trustee-789', 'appointment-012');
    const card = screen.getByTestId('upcoming-key-dates-card');
    expect(card).toHaveAttribute('data-variant', 'ch12-13-case-by-case');
    expect(card).toHaveAttribute('data-has-data', 'true');
    // The card builds its edit route from these, so a swap would 404 silently.
    expect(card).toHaveAttribute('data-trustee-id', 'trustee-789');
    expect(card).toHaveAttribute('data-appointment-id', 'appointment-012');
  });

  test.each([
    ['enabled', true],
    ['disabled', false],
  ])(
    'forwards the TPR_DISPLAY_UPDATES flag to the card when %s',
    async (_label, tprDisplayUpdates) => {
      vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
        [DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES]: true,
        [TPR_DISPLAY_UPDATES]: tprDisplayUpdates,
      });
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

      renderBody();

      await waitFor(() => {
        expect(screen.getByTestId('upcoming-key-dates-card')).toHaveAttribute(
          'data-tpr-display-updates',
          String(tprDisplayUpdates),
        );
      });
    },
  );

  test('reports the loading state to the card while the fetch is in flight', () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockImplementation(() => new Promise(() => {}));

    renderBody();

    expect(screen.getByTestId('upcoming-key-dates-card')).toHaveAttribute(
      'data-is-loading',
      'true',
    );
  });

  test.each([
    [chapter12Appointment, 'Southern District of New York (Manhattan): Chapter 12 - Case by Case'],
    [chapter13Appointment, 'Southern District of New York (Manhattan): Chapter 13 - Case by Case'],
  ])(
    'builds the district/division/chapter appointment heading for $chapter',
    async (appointment, expectedHeading) => {
      vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: keyDates });

      renderBody(appointment);

      await waitFor(() => {
        expect(screen.getByTestId('upcoming-key-dates-card')).toHaveAttribute(
          'data-appointment-heading',
          expectedHeading,
        );
      });
    },
  );

  test('forwards null data when no key dates document exists', async () => {
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockResolvedValue({ data: null });

    renderBody();

    await waitFor(() => {
      expect(screen.getByTestId('upcoming-key-dates-card')).toHaveAttribute(
        'data-has-data',
        'false',
      );
    });
  });

  test('shows an error alert instead of the card when the fetch fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Api2, 'getUpcomingKeyDates').mockRejectedValue(new Error('network error'));

    renderBody();

    await waitFor(() => {
      expect(
        screen.getByTestId(`alert-ch12-13-case-by-case-key-dates-error-${chapter12Appointment.id}`),
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
  });

  test('does not fetch or render the card when the feature flag is disabled', () => {
    vi.spyOn(featureFlagsHook, 'default').mockReturnValue({
      [DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES]: false,
    });
    const getSpy = vi.spyOn(Api2, 'getUpcomingKeyDates');

    renderBody();

    expect(getSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId('upcoming-key-dates-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('appointment-basic-fields')).toBeInTheDocument();
  });
});
