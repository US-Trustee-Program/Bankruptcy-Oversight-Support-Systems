import AppointmentBasicFields from './AppointmentBasicFields';
import BondKeyDatesCard from './BondKeyDatesCard';
import KeyDatesGate from './KeyDatesGate';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import useFeatureFlags, { TRUSTEE_APPOINTMENT_ACCORDIONS } from '@/lib/hooks/UseFeatureFlags';
import { buildAppointmentHeading } from './appointmentDisplay';

export interface Chapter7ElectedAppointmentBodyProps {
  appointment: TrusteeAppointment;
}

export default function Chapter7ElectedAppointmentBody(
  props: Readonly<Chapter7ElectedAppointmentBodyProps>,
) {
  const { appointment } = props;
  // The backend key-dates endpoint authorizes on this same flag, so the fetch
  // must be gated on it to avoid a guaranteed-to-fail request.
  const featureFlags = useFeatureFlags();
  const displayKeyDates = featureFlags[TRUSTEE_APPOINTMENT_ACCORDIONS] === true;

  const appointmentHeading = buildAppointmentHeading(appointment);

  return (
    <>
      <AppointmentBasicFields appointment={appointment} />
      <KeyDatesGate
        trusteeId={appointment.trusteeId}
        appointmentId={appointment.id}
        shouldFetch={displayKeyDates}
        errorId={`bond-key-dates-error-${appointment.id}`}
        errorMessage="Failed to load bond key dates. Please refresh and try again."
      >
        {(data, isLoading) => (
          <BondKeyDatesCard
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
