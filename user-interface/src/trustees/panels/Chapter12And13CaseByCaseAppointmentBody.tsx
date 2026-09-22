import './Chapter12And13CaseByCaseAppointmentBody.scss';
import AppointmentBasicFields from './AppointmentBasicFields';
import AnnualReportKeyDatesCard from './AnnualReportKeyDatesCard';
import TrusteePerformanceReportKeyDatesCard from './TrusteePerformanceReportKeyDatesCard';
import KeyDatesGate from './KeyDatesGate';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import useFeatureFlags, {
  DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES,
  TPR_DISPLAY_UPDATES,
} from '@/lib/hooks/UseFeatureFlags';
import { buildAppointmentHeading } from './appointmentDisplay';

export interface Chapter12And13CaseByCaseAppointmentBodyProps {
  appointment: TrusteeAppointment;
}

export default function Chapter12And13CaseByCaseAppointmentBody(
  props: Readonly<Chapter12And13CaseByCaseAppointmentBodyProps>,
) {
  const { appointment } = props;
  // The backend key-dates endpoint authorizes on this same flag, so the fetch
  // must be gated on it to avoid a guaranteed-to-fail request.
  const featureFlags = useFeatureFlags();
  const displayKeyDates = featureFlags[DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES] === true;
  const tprDisplayUpdates = !!featureFlags[TPR_DISPLAY_UPDATES];

  const appointmentHeading = buildAppointmentHeading(appointment);

  return (
    <>
      <AppointmentBasicFields appointment={appointment} />
      <KeyDatesGate
        trusteeId={appointment.trusteeId}
        appointmentId={appointment.id}
        shouldFetch={displayKeyDates}
        errorId={`ch12-13-case-by-case-key-dates-error-${appointment.id}`}
        errorMessage="Failed to load upcoming key dates. Please refresh and try again."
      >
        {(data, isLoading) => (
          <div
            className="ch12-13-case-by-case-cards"
            data-testid={`ch12-13-case-by-case-cards-${appointment.id}`}
          >
            <AnnualReportKeyDatesCard
              trusteeId={appointment.trusteeId}
              appointmentId={appointment.id}
              appointmentHeading={appointmentHeading}
              data={data}
              isLoading={isLoading}
            />
            <TrusteePerformanceReportKeyDatesCard
              trusteeId={appointment.trusteeId}
              appointmentId={appointment.id}
              appointmentHeading={appointmentHeading}
              data={data}
              isLoading={isLoading}
              tprDisplayUpdates={tprDisplayUpdates}
            />
          </div>
        )}
      </KeyDatesGate>
    </>
  );
}
