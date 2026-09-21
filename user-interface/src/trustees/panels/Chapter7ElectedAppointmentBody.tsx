import AppointmentBasicFields from './AppointmentBasicFields';
import BondKeyDatesCard from './BondKeyDatesCard';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { getAppointmentDetails } from '@common/cams/trustees';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import useFeatureFlags, { DISPLAY_CHPT7_ELECTED_KEY_DATES } from '@/lib/hooks/UseFeatureFlags';
import { useUpcomingKeyDates } from './useUpcomingKeyDates';
import { buildAppointmentHeading } from './appointmentDisplay';

export interface Chapter7ElectedAppointmentBodyProps {
  appointment: TrusteeAppointment;
}

export default function Chapter7ElectedAppointmentBody(
  props: Readonly<Chapter7ElectedAppointmentBodyProps>,
) {
  const { appointment } = props;
  // The backend key-dates endpoint authorizes on DISPLAY_CHPT7_ELECTED_KEY_DATES,
  // not the accordion flag, so the fetch must also be gated on it to avoid a
  // guaranteed-to-fail request when the accordion flag is enabled on its own.
  const featureFlags = useFeatureFlags();
  const displayKeyDates = featureFlags[DISPLAY_CHPT7_ELECTED_KEY_DATES] === true;
  const {
    data: keyDates,
    isLoading: isKeyDatesLoading,
    error: keyDatesLoadError,
  } = useUpcomingKeyDates(appointment.trusteeId, appointment.id, displayKeyDates);

  const appointmentHeading = buildAppointmentHeading(
    appointment,
    getAppointmentDetails(appointment.chapter, appointment.appointmentType),
  );

  return (
    <>
      <AppointmentBasicFields appointment={appointment} />
      {displayKeyDates && keyDatesLoadError && (
        <Alert
          id="bond-key-dates-error"
          type={UswdsAlertStyle.Error}
          inline={true}
          show={true}
          slim
        >
          Failed to load bond key dates. Please refresh and try again.
        </Alert>
      )}
      {displayKeyDates && !keyDatesLoadError && (
        <BondKeyDatesCard
          trusteeId={appointment.trusteeId}
          appointmentId={appointment.id}
          appointmentHeading={appointmentHeading}
          data={keyDates}
          isLoading={isKeyDatesLoading}
        />
      )}
    </>
  );
}
