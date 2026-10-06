import './AppointmentBasicFields.scss';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { formatAppointmentDate } from './appointmentDisplay';
import useEditTrusteeAppointment from '@/lib/hooks/UseEditTrusteeAppointment';

export interface AppointmentBasicFieldsProps {
  appointment: TrusteeAppointment;
}

export default function AppointmentBasicFields(props: Readonly<AppointmentBasicFieldsProps>) {
  const { appointment } = props;
  const { canManage, openEditTrustee } = useEditTrusteeAppointment(appointment);

  return (
    <div className="appointment-basic-fields">
      <span className="appointment-body-field" data-testid="appointment-body-appointed-date">
        <span className="appointment-body-label">Appointed:</span>{' '}
        {formatAppointmentDate(appointment.appointedDate)}
      </span>
      <span className="appointment-body-field" data-testid="appointment-body-status-effective-date">
        <span className="appointment-body-label">Status Effective:</span>{' '}
        {formatAppointmentDate(appointment.effectiveDate)}
      </span>
      {canManage && (
        <Button
          id={`edit-trustee-appointment-${appointment.id}`}
          uswdsStyle={UswdsButtonStyle.Unstyled}
          aria-label="Edit trustee appointment"
          title="Edit trustee appointment"
          onClick={openEditTrustee}
        >
          <IconLabel icon="edit" label="Edit Appointment" />
        </Button>
      )}
    </div>
  );
}
