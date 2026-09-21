import AppointmentBasicFields from './AppointmentBasicFields';
import PastKeyDates from './PastKeyDates';
import { isChapter11SubchapterVPool, TrusteeAppointment } from '@common/cams/trustee-appointments';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import useFeatureFlags, { DISPLAY_CHPT11_SUBV_PAST_KEY_DATES } from '@/lib/hooks/UseFeatureFlags';
import { useUpcomingKeyDates } from './useUpcomingKeyDates';
import { buildAppointmentHeading } from './appointmentDisplay';

export interface Chapter11SubchapterVAppointmentBodyProps {
  appointment: TrusteeAppointment;
}

export default function Chapter11SubchapterVAppointmentBody(
  props: Readonly<Chapter11SubchapterVAppointmentBodyProps>,
) {
  const { appointment } = props;
  const featureFlags = useFeatureFlags();
  const shouldShowPoolPastKeyDates =
    featureFlags[DISPLAY_CHPT11_SUBV_PAST_KEY_DATES] === true &&
    isChapter11SubchapterVPool(appointment.chapter, appointment.appointmentType);
  const {
    data: keyDates,
    isLoading: isKeyDatesLoading,
    error: keyDatesLoadError,
  } = useUpcomingKeyDates(appointment.trusteeId, appointment.id, shouldShowPoolPastKeyDates);

  const appointmentHeading = buildAppointmentHeading(appointment);

  return (
    <>
      <AppointmentBasicFields appointment={appointment} />
      {shouldShowPoolPastKeyDates && keyDatesLoadError && (
        <Alert
          id={`subv-past-key-dates-error-${appointment.id}`}
          type={UswdsAlertStyle.Error}
          inline={true}
          show={true}
          slim
        >
          Failed to load past key dates. Please refresh and try again.
        </Alert>
      )}
      {shouldShowPoolPastKeyDates && !keyDatesLoadError && (
        <PastKeyDates
          variant="subv-pool"
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
