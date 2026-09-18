import AppointmentBasicFields from './AppointmentBasicFields';
import PastKeyDates from './PastKeyDates';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { formatChapterType } from '@common/cams/trustees';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import useFeatureFlags, { DISPLAY_CHPT11_SUBV_PAST_KEY_DATES } from '@/lib/hooks/UseFeatureFlags';
import { useUpcomingKeyDates } from './useUpcomingKeyDates';
import { buildDistrictDisplay } from './appointmentDisplay';

export interface Chapter11SubchapterVAppointmentBodyProps {
  appointment: TrusteeAppointment;
}

export default function Chapter11SubchapterVAppointmentBody(
  props: Readonly<Chapter11SubchapterVAppointmentBodyProps>,
) {
  const { appointment } = props;
  const featureFlags = useFeatureFlags();
  const displayPastKeyDates =
    featureFlags[DISPLAY_CHPT11_SUBV_PAST_KEY_DATES] === true &&
    appointment.appointmentType === 'pool';
  const {
    data: keyDates,
    isLoading: isKeyDatesLoading,
    error: keyDatesLoadError,
  } = useUpcomingKeyDates(appointment.trusteeId, appointment.id, displayPastKeyDates);

  const districtDisplay = buildDistrictDisplay(appointment);
  const appointmentHeading = `${districtDisplay}${
    appointment.courtDivisionName ? ` (${appointment.courtDivisionName})` : ''
  }: Chapter ${formatChapterType(appointment.chapter)}`;

  return (
    <>
      <AppointmentBasicFields appointment={appointment} />
      {displayPastKeyDates && keyDatesLoadError && (
        <Alert
          id="subv-past-key-dates-error"
          type={UswdsAlertStyle.Error}
          inline={true}
          show={true}
          slim
        >
          Failed to load past key dates. Please refresh and try again.
        </Alert>
      )}
      {displayPastKeyDates && !keyDatesLoadError && (
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
