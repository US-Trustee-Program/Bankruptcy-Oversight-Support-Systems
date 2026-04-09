import { Link } from 'react-router-dom';
import { CamsRole } from '@common/cams/roles';
import LocalStorage from '@/lib/utils/local-storage';

interface TrusteeNameProps {
  trusteeName: string;
  trusteeId?: string | null;
}

/**
 * Displays trustee name as a link to the trustee profile if trusteeId is available
 * and the user has the TrusteeAdmin role, otherwise displays plain text.
 */
export function TrusteeName({ trusteeName, trusteeId }: TrusteeNameProps) {
  const session = LocalStorage.getSession();
  const hasAccess = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  if (!trusteeId || !hasAccess) return <>{trusteeName}</>;

  return (
    <Link
      to={`/trustees/${trusteeId}`}
      data-testid="case-detail-trustee-link"
      aria-label={`View trustee profile for ${trusteeName}`}
    >
      {trusteeName}
    </Link>
  );
}
