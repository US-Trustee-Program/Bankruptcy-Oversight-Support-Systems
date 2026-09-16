import { CamsRole } from '@common/cams/roles';
import LocalStorage from '@/lib/utils/local-storage';

export default function useCanManageTrustees(): boolean {
  const session = LocalStorage.getSession();
  return !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);
}
