import { useNavigate } from 'react-router-dom';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { CamsRole } from '@common/cams/roles';
import LocalStorage from '@/lib/utils/local-storage';

function useEditTrusteeAppointment(appointment: TrusteeAppointment) {
  const navigate = useNavigate();
  const session = LocalStorage.getSession();
  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  function openEditTrustee() {
    navigate(`/trustees/${appointment.trusteeId}/appointments/${appointment.id}/edit`);
  }

  return { canManage, openEditTrustee };
}

export default useEditTrusteeAppointment;
