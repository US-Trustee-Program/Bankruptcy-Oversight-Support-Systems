import AppointmentBasicFields from './AppointmentBasicFields';
import Chapter13StandingAuditCard from './Chapter13StandingAuditCard';
import TrusteePerformanceReportCard from './TrusteePerformanceReportCard';
import Chapter13StandingBudgetCard from './Chapter13StandingBudgetCard';
import Chapter13StandingOtherCard from './Chapter13StandingOtherCard';
import KeyDatesGate from './KeyDatesGate';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import useFeatureFlags, { TRUSTEE_APPOINTMENT_ACCORDIONS } from '@/lib/hooks/UseFeatureFlags';

export interface Chapter13StandingAppointmentBodyProps {
  appointment: TrusteeAppointment;
}

export default function Chapter13StandingAppointmentBody(
  props: Readonly<Chapter13StandingAppointmentBodyProps>,
) {
  const { appointment } = props;
  const featureFlags = useFeatureFlags();
  const displayKeyDates = featureFlags[TRUSTEE_APPOINTMENT_ACCORDIONS] === true;

  const commonCardProps = {
    trusteeId: appointment.trusteeId,
    appointmentId: appointment.id,
  };

  return (
    <>
      <AppointmentBasicFields appointment={appointment} />
      <KeyDatesGate
        trusteeId={appointment.trusteeId}
        appointmentId={appointment.id}
        shouldFetch={displayKeyDates}
        errorId={`chapter13-standing-key-dates-error-${appointment.id}`}
        errorMessage="Failed to load Chapter 13 Standing key dates. Please refresh and try again."
      >
        {(data, isLoading) =>
          isLoading ? (
            <LoadingSpinner id="chapter13-standing-key-dates-loading" />
          ) : (
            <div
              className="chapter13-standing-cards-stack"
              data-testid="chapter13-standing-cards-stack"
            >
              <Chapter13StandingAuditCard {...commonCardProps} data={data} />
              <TrusteePerformanceReportCard
                {...commonCardProps}
                data={data}
                // The card's own spinner is unreachable while the body-level short-circuit above
                // exists, but this prop is kept forward-compatible for when that short-circuit is removed.
                isLoading={isLoading}
                variant="chapter13-standing"
              />
              <Chapter13StandingBudgetCard appointmentId={appointment.id} />
              <Chapter13StandingOtherCard {...commonCardProps} data={data} />
            </div>
          )
        }
      </KeyDatesGate>
    </>
  );
}
