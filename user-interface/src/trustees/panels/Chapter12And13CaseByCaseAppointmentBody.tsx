import './Chapter12And13CaseByCaseAppointmentBody.scss';
import AppointmentBasicFields from './AppointmentBasicFields';
import AnnualReportKeyDatesCard from './AnnualReportKeyDatesCard';
import TrusteePerformanceReportKeyDatesCard from './TrusteePerformanceReportKeyDatesCard';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import useFeatureFlags, {
  DISPLAY_CHPT12_13_CASE_BY_CASE_UPCOMING_KEY_DATES,
} from '@/lib/hooks/UseFeatureFlags';
import { useUpcomingKeyDates } from './useUpcomingKeyDates';
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
  const {
    data: keyDates,
    isLoading: isKeyDatesLoading,
    error: keyDatesLoadError,
  } = useUpcomingKeyDates(appointment.trusteeId, appointment.id, displayKeyDates);

  const appointmentHeading = buildAppointmentHeading(appointment);

  return (
    <>
      <AppointmentBasicFields appointment={appointment} />
      {keyDatesLoadError && (
        <Alert
          id={`ch12-13-case-by-case-key-dates-error-${appointment.id}`}
          type={UswdsAlertStyle.Error}
          inline={true}
          show={true}
          slim
        >
          Failed to load upcoming key dates. Please refresh and try again.
        </Alert>
      )}
      {displayKeyDates && !keyDatesLoadError && (
        <div
          className="ch12-13-case-by-case-cards"
          data-testid={`ch12-13-case-by-case-cards-${appointment.id}`}
        >
          <AnnualReportKeyDatesCard
            trusteeId={appointment.trusteeId}
            appointmentId={appointment.id}
            appointmentHeading={appointmentHeading}
            data={keyDates}
            isLoading={isKeyDatesLoading}
          />
          <TrusteePerformanceReportKeyDatesCard
            trusteeId={appointment.trusteeId}
            appointmentId={appointment.id}
            appointmentHeading={appointmentHeading}
            data={keyDates}
            isLoading={isKeyDatesLoading}
          />
        </div>
      )}
    </>
  );
}
