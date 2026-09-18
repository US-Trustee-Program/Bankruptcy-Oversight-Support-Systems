import AppointmentBasicFields from './AppointmentBasicFields';
import Chapter7PanelAuditFieldExamCard from './Chapter7PanelAuditFieldExamCard';
import Chapter7PanelTrusteePerformanceReportCard from './Chapter7PanelTrusteePerformanceReportCard';
import Chapter7PanelTrusteeInterimReportCard from './Chapter7PanelTrusteeInterimReportCard';
import Chapter7PanelOtherKeyDatesCard from './Chapter7PanelOtherKeyDatesCard';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import useFeatureFlags, {
  DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES,
} from '@/lib/hooks/UseFeatureFlags';
import { useUpcomingKeyDates } from './useUpcomingKeyDates';
import { buildAppointmentHeading } from './appointmentDisplay';

export interface Chapter7PanelAppointmentBodyProps {
  appointment: TrusteeAppointment;
}

export default function Chapter7PanelAppointmentBody(
  props: Readonly<Chapter7PanelAppointmentBodyProps>,
) {
  const { appointment } = props;
  // The backend key-dates endpoint authorizes on DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES,
  // not the accordion flag, so the fetch must also be gated on it to avoid a
  // guaranteed-to-fail request when the accordion flag is enabled on its own.
  const featureFlags = useFeatureFlags();
  const displayKeyDates = featureFlags[DISPLAY_CHPT7_PANEL_UPCOMING_KEY_DATES] === true;
  const {
    data: keyDates,
    isLoading: isKeyDatesLoading,
    error: keyDatesLoadError,
  } = useUpcomingKeyDates(appointment.trusteeId, appointment.id, displayKeyDates);

  const appointmentHeading = buildAppointmentHeading(appointment);

  return (
    <>
      <AppointmentBasicFields appointment={appointment} />
      {displayKeyDates && keyDatesLoadError && (
        <Alert
          id="chapter7-panel-key-dates-error"
          type={UswdsAlertStyle.Error}
          inline={true}
          show={true}
          slim
        >
          Failed to load Chapter 7 Panel key dates. Please refresh and try again.
        </Alert>
      )}
      {displayKeyDates && !keyDatesLoadError && (
        <>
          <Chapter7PanelAuditFieldExamCard
            trusteeId={appointment.trusteeId}
            appointmentId={appointment.id}
            appointmentHeading={appointmentHeading}
            data={keyDates}
            isLoading={isKeyDatesLoading}
          />
          <Chapter7PanelTrusteePerformanceReportCard
            trusteeId={appointment.trusteeId}
            appointmentId={appointment.id}
            appointmentHeading={appointmentHeading}
            data={keyDates}
            isLoading={isKeyDatesLoading}
          />
          <Chapter7PanelTrusteeInterimReportCard
            trusteeId={appointment.trusteeId}
            appointmentId={appointment.id}
            appointmentHeading={appointmentHeading}
            data={keyDates}
            isLoading={isKeyDatesLoading}
          />
          <Chapter7PanelOtherKeyDatesCard
            trusteeId={appointment.trusteeId}
            appointmentId={appointment.id}
            data={keyDates}
            isLoading={isKeyDatesLoading}
          />
        </>
      )}
    </>
  );
}
