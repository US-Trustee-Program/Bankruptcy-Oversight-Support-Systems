import AppointmentBasicFields from './AppointmentBasicFields';
import Chapter7PanelAuditFieldExamCard from './Chapter7PanelAuditFieldExamCard';
import Chapter7PanelTrusteePerformanceReportCard from './Chapter7PanelTrusteePerformanceReportCard';
import Chapter7PanelTrusteeInterimReportCard from './Chapter7PanelTrusteeInterimReportCard';
import Chapter7PanelOtherKeyDatesCard from './Chapter7PanelOtherKeyDatesCard';
import KeyDatesGate from './KeyDatesGate';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import useFeatureFlags, { TRUSTEE_APPOINTMENT_ACCORDIONS } from '@/lib/hooks/UseFeatureFlags';

export interface Chapter7PanelAppointmentBodyProps {
  appointment: TrusteeAppointment;
}

export default function Chapter7PanelAppointmentBody(
  props: Readonly<Chapter7PanelAppointmentBodyProps>,
) {
  const { appointment } = props;
  // The backend key-dates endpoint authorizes on this same flag, so the fetch
  // must be gated on it to avoid a guaranteed-to-fail request.
  const featureFlags = useFeatureFlags();
  const displayKeyDates = featureFlags[TRUSTEE_APPOINTMENT_ACCORDIONS] === true;

  return (
    <>
      <AppointmentBasicFields appointment={appointment} />
      <KeyDatesGate
        trusteeId={appointment.trusteeId}
        appointmentId={appointment.id}
        shouldFetch={displayKeyDates}
        errorId={`chapter7-panel-key-dates-error-${appointment.id}`}
        errorMessage="Failed to load Chapter 7 Panel key dates. Please refresh and try again."
      >
        {(data, isLoading) => (
          <>
            <Chapter7PanelAuditFieldExamCard
              trusteeId={appointment.trusteeId}
              appointmentId={appointment.id}
              data={data}
              isLoading={isLoading}
            />
            <Chapter7PanelTrusteePerformanceReportCard
              trusteeId={appointment.trusteeId}
              appointmentId={appointment.id}
              data={data}
              isLoading={isLoading}
            />
            <Chapter7PanelTrusteeInterimReportCard
              trusteeId={appointment.trusteeId}
              appointmentId={appointment.id}
              data={data}
              isLoading={isLoading}
            />
            <Chapter7PanelOtherKeyDatesCard
              trusteeId={appointment.trusteeId}
              appointmentId={appointment.id}
              data={data}
              isLoading={isLoading}
            />
          </>
        )}
      </KeyDatesGate>
    </>
  );
}
