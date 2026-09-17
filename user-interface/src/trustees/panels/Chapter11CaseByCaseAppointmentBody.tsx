import AppointmentBasicFields from './AppointmentBasicFields';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';

export interface Chapter11CaseByCaseAppointmentBodyProps {
  appointment: TrusteeAppointment;
}

export default function Chapter11CaseByCaseAppointmentBody(
  props: Readonly<Chapter11CaseByCaseAppointmentBodyProps>,
) {
  const { appointment } = props;

  return <AppointmentBasicFields appointment={appointment} />;
}
