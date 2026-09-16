import { useEffect, useState } from 'react';
import AppointmentBasicFields from './AppointmentBasicFields';
import BondKeyDatesCard from './BondKeyDatesCard';
import Api2 from '@/lib/models/api2';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import useFeatureFlags, { DISPLAY_CHPT7_ELECTED_KEY_DATES } from '@/lib/hooks/UseFeatureFlags';

export interface Chapter7ElectedAppointmentBodyProps {
  appointment: TrusteeAppointment;
}

export default function Chapter7ElectedAppointmentBody(
  props: Readonly<Chapter7ElectedAppointmentBodyProps>,
) {
  const { appointment } = props;
  // The backend key-dates endpoint authorizes on DISPLAY_CHPT7_ELECTED_KEY_DATES,
  // not the accordion flag, so the fetch must also be gated on it to avoid a
  // guaranteed-to-fail request when the accordion flag is enabled on its own.
  const featureFlags = useFeatureFlags();
  const displayKeyDates = featureFlags[DISPLAY_CHPT7_ELECTED_KEY_DATES] === true;
  const [keyDates, setKeyDates] = useState<TrusteeUpcomingKeyDates | null>(null);
  const [isKeyDatesLoading, setIsKeyDatesLoading] = useState(displayKeyDates);
  const [keyDatesLoadError, setKeyDatesLoadError] = useState(false);

  useEffect(() => {
    if (!displayKeyDates) {
      return;
    }
    setIsKeyDatesLoading(true);
    setKeyDatesLoadError(false);
    Api2.getUpcomingKeyDates(appointment.trusteeId, appointment.id)
      .then((response) => {
        setKeyDates(response.data);
      })
      .catch((error) => {
        console.error('Could not load bond key dates', error);
        setKeyDatesLoadError(true);
      })
      .finally(() => {
        setIsKeyDatesLoading(false);
      });
  }, [appointment.trusteeId, appointment.id, displayKeyDates]);

  return (
    <>
      <AppointmentBasicFields appointment={appointment} />
      {displayKeyDates && keyDatesLoadError && (
        <Alert
          id="bond-key-dates-error"
          type={UswdsAlertStyle.Error}
          inline={true}
          show={true}
          slim
        >
          Failed to load bond key dates. Please refresh and try again.
        </Alert>
      )}
      {displayKeyDates && !keyDatesLoadError && (
        <BondKeyDatesCard
          trusteeId={appointment.trusteeId}
          appointmentId={appointment.id}
          data={keyDates}
          isLoading={isKeyDatesLoading}
        />
      )}
    </>
  );
}
