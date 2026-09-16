import { useEffect, useState } from 'react';
import AppointmentBasicFields from './AppointmentBasicFields';
import BondKeyDatesCard from './BondKeyDatesCard';
import Api2 from '@/lib/models/api2';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';

export interface Chapter7ElectedAppointmentBodyProps {
  appointment: TrusteeAppointment;
}

export default function Chapter7ElectedAppointmentBody(
  props: Readonly<Chapter7ElectedAppointmentBodyProps>,
) {
  const { appointment } = props;
  const [keyDates, setKeyDates] = useState<TrusteeUpcomingKeyDates | null>(null);
  const [isKeyDatesLoading, setIsKeyDatesLoading] = useState(true);

  useEffect(() => {
    setIsKeyDatesLoading(true);
    Api2.getUpcomingKeyDates(appointment.trusteeId, appointment.id)
      .then((response) => {
        setKeyDates(response.data);
      })
      .catch((error) => {
        console.error('Could not load bond key dates', error);
        setKeyDates(null);
      })
      .finally(() => {
        setIsKeyDatesLoading(false);
      });
  }, [appointment.trusteeId, appointment.id]);

  return (
    <>
      <AppointmentBasicFields appointment={appointment} />
      <BondKeyDatesCard
        trusteeId={appointment.trusteeId}
        appointmentId={appointment.id}
        data={keyDates}
        isLoading={isKeyDatesLoading}
      />
    </>
  );
}
