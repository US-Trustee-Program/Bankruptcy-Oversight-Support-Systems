import './Chapter11CaseByCaseAppointmentBody.scss';
import { useNavigate } from 'react-router-dom';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import { formatAppointmentDate } from './appointmentDisplay';

export interface Chapter11CaseByCaseAppointmentBodyProps {
  appointment: TrusteeAppointment;
}

export default function Chapter11CaseByCaseAppointmentBody(
  props: Readonly<Chapter11CaseByCaseAppointmentBodyProps>,
) {
  const { appointment } = props;
  const navigate = useNavigate();
  const session = LocalStorage.getSession();
  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  function openEditTrustee() {
    navigate(`/trustees/${appointment.trusteeId}/appointments/${appointment.id}/edit`);
  }

  return (
    <div className="chapter11-case-by-case-appointment-body">
      <span className="appointment-body-field">
        <span className="info-card-label">Appointed:</span>{' '}
        {formatAppointmentDate(appointment.appointedDate)}
      </span>
      <span className="appointment-body-field">
        <span className="info-card-label">Status Effective:</span>{' '}
        {formatAppointmentDate(appointment.effectiveDate)}
      </span>
      {canManage && (
        <Button
          id="edit-trustee-appointment"
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
