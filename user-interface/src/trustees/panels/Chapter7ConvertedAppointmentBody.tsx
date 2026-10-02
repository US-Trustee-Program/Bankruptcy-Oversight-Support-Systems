import AppointmentBasicFields from './AppointmentBasicFields';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';

export interface Chapter7ConvertedAppointmentBodyProps {
  appointment: TrusteeAppointment;
}

export default function Chapter7ConvertedAppointmentBody(
  props: Readonly<Chapter7ConvertedAppointmentBodyProps>,
) {
  const { appointment } = props;

  return <AppointmentBasicFields appointment={appointment} />;
}
