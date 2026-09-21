import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';

/**
 * Whether the current user holds the TrusteeAdmin role and can therefore manage
 * (edit) trustee data. Shared by the Chapter 13 Standing key-dates cards.
 */
export function useCanManageTrustees(): boolean {
  const session = LocalStorage.getSession();
  return !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);
}
