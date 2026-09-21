import AppointmentBasicFields from './AppointmentBasicFields';
import PastKeyDates from './PastKeyDates';
import KeyDatesGate from './KeyDatesGate';
import { isChapter11SubchapterVPool, TrusteeAppointment } from '@common/cams/trustee-appointments';
import useFeatureFlags, { DISPLAY_CHPT11_SUBV_PAST_KEY_DATES } from '@/lib/hooks/UseFeatureFlags';
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

  const appointmentHeading = buildAppointmentHeading(appointment);

  return (
    <>
      <AppointmentBasicFields appointment={appointment} />
      <KeyDatesGate
        trusteeId={appointment.trusteeId}
        appointmentId={appointment.id}
        shouldFetch={shouldShowPoolPastKeyDates}
        errorId={`subv-past-key-dates-error-${appointment.id}`}
        errorMessage="Failed to load past key dates. Please refresh and try again."
      >
        {(data, isLoading) => (
          <PastKeyDates
            variant="subv-pool"
            trusteeId={appointment.trusteeId}
            appointmentId={appointment.id}
            appointmentHeading={appointmentHeading}
            data={data}
            isLoading={isLoading}
          />
        )}
      </KeyDatesGate>
    </>
  );
}
