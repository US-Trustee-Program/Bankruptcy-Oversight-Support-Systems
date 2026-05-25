import { Link } from 'react-router-dom';
import { CamsRole } from '@common/cams/roles';
import LocalStorage from '@/lib/utils/local-storage';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';

interface TrusteeNameProps {
  trusteeName: string;
  trusteeId?: string | null;
  openNewTab?: boolean;
  onAdditionalClick?: () => void;
}

/**
 * Displays trustee name as a link to the trustee profile if trusteeId is available
 * and the user has the TrusteeAdmin role, otherwise displays plain text.
 * When openNewTab is true, the link opens in a new tab.
 */
export function TrusteeName({
  trusteeName,
  trusteeId,
  openNewTab = false,
  onAdditionalClick,
}: TrusteeNameProps) {
  const session = LocalStorage.getSession();
  const hasAccess = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  if (!trusteeId || !hasAccess) return <>{trusteeName}</>;

  const handleClick = () => {
    getAppInsights().appInsights.trackEvent({ name: 'Trustee Profile Navigated' });
    onAdditionalClick?.();
  };

  return (
    <Link
      to={`/trustees/${trusteeId}`}
      data-testid="case-detail-trustee-link"
      aria-label={`View trustee profile for ${trusteeName}${openNewTab ? ' (opens in new tab)' : ''}`}
      target={openNewTab ? '_blank' : undefined}
      rel={openNewTab ? 'noopener noreferrer' : undefined}
      title={openNewTab ? 'View trustee in new tab' : undefined}
      onClick={handleClick}
    >
      {trusteeName}
    </Link>
  );
}
