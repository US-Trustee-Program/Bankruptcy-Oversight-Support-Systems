import AppointmentBasicFields from './AppointmentBasicFields';
import Chapter11SubVOtherKeyDatesCard from './Chapter11SubVOtherKeyDatesCard';
import KeyDatesGate from './KeyDatesGate';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
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
  const shouldShowOtherKeyDates = featureFlags[DISPLAY_CHPT11_SUBV_PAST_KEY_DATES] === true;

  const appointmentHeading = buildAppointmentHeading(appointment);

  return (
    <>
      <AppointmentBasicFields appointment={appointment} />
      <KeyDatesGate
        trusteeId={appointment.trusteeId}
        appointmentId={appointment.id}
        shouldFetch={shouldShowOtherKeyDates}
        errorId={`subv-past-key-dates-error-${appointment.id}`}
        errorMessage="Failed to load other key dates. Please refresh and try again."
      >
        {(data, isLoading) => (
          <Chapter11SubVOtherKeyDatesCard
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
