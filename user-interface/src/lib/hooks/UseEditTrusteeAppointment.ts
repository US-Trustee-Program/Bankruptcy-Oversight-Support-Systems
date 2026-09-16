import { useNavigate } from 'react-router-dom';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import useCanManageTrustees from './UseCanManageTrustees';

function useEditTrusteeAppointment(appointment: TrusteeAppointment) {
  const navigate = useNavigate();
  const canManage = useCanManageTrustees();

  function openEditTrustee() {
    navigate(`/trustees/${appointment.trusteeId}/appointments/${appointment.id}/edit`);
  }

  return { canManage, openEditTrustee };
}

export default useEditTrusteeAppointment;
