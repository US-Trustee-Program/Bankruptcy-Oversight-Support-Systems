import AppointmentBasicFields from './AppointmentBasicFields';
import Chapter12StandingAuditCard from './Chapter12StandingAuditCard';
import Chapter12StandingTrusteePerformanceReportCard from './Chapter12StandingTrusteePerformanceReportCard';
import Chapter12StandingBudgetCard from './Chapter12StandingBudgetCard';
import Chapter12StandingOtherKeyDatesCard from './Chapter12StandingOtherKeyDatesCard';
import KeyDatesGate from './KeyDatesGate';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import useFeatureFlags, {
  DISPLAY_CHPT12_STANDING_KEY_DATES,
  TPR_DISPLAY_UPDATES,
} from '@/lib/hooks/UseFeatureFlags';

export interface Chapter12StandingAppointmentBodyProps {
  appointment: TrusteeAppointment;
}

export default function Chapter12StandingAppointmentBody(
  props: Readonly<Chapter12StandingAppointmentBodyProps>,
) {
  const { appointment } = props;
  const featureFlags = useFeatureFlags();
  const displayKeyDates = featureFlags[DISPLAY_CHPT12_STANDING_KEY_DATES] === true;
  const tprDisplayUpdates = featureFlags[TPR_DISPLAY_UPDATES] === true;

  return (
    <>
      <AppointmentBasicFields appointment={appointment} />
      <KeyDatesGate
        trusteeId={appointment.trusteeId}
        appointmentId={appointment.id}
        shouldFetch={displayKeyDates}
        errorId={`chapter12-standing-key-dates-error-${appointment.id}`}
        errorMessage="Failed to load Chapter 12 Standing key dates. Please refresh and try again."
      >
        {(data, isLoading) => (
          <>
            <Chapter12StandingAuditCard
              trusteeId={appointment.trusteeId}
              appointmentId={appointment.id}
              data={data}
              isLoading={isLoading}
            />
            <Chapter12StandingTrusteePerformanceReportCard
              trusteeId={appointment.trusteeId}
              appointmentId={appointment.id}
              data={data}
              isLoading={isLoading}
              tprDisplayUpdates={tprDisplayUpdates}
            />
            <Chapter12StandingBudgetCard appointmentId={appointment.id} />
            <Chapter12StandingOtherKeyDatesCard
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
