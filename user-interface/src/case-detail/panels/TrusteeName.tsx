import { Link } from 'react-router-dom';
import { CamsRole } from '@common/cams/roles';
import LocalStorage from '@/lib/utils/local-storage';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';

type TrusteeNavigationSource = 'trustee-list' | 'case-detail' | 'case-detail-past';

interface TrusteeNameProps {
  trusteeName: string;
  trusteeId?: string | null;
  openNewTab?: boolean;
  source?: TrusteeNavigationSource;
  dataTestId?: string;
}

export function TrusteeName({
  trusteeName,
  trusteeId,
  openNewTab = true,
  source = 'case-detail',
  dataTestId = 'case-detail-trustee-link',
}: TrusteeNameProps) {
  const session = LocalStorage.getSession();
  const hasAccess = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  if (!trusteeId || !hasAccess) return <>{trusteeName}</>;

  const handleClick = () => {
    getAppInsights().appInsights.trackEvent({
      name: 'Trustee Profile Navigated',
      properties: { source },
    });
  };

  const linkContent = openNewTab ? (
    <IconLabel label={trusteeName} icon="launch" location="left" />
  ) : (
    trusteeName
  );

  return (
    <Link
      to={`/trustees/${trusteeId}`}
      className="usa-link"
      data-testid={dataTestId}
      aria-label={`View trustee profile for ${trusteeName}${openNewTab ? ' (opens in new tab)' : ''}`}
      target={openNewTab ? '_blank' : undefined}
      rel={openNewTab ? 'noopener noreferrer' : undefined}
      onClick={handleClick}
    >
      {linkContent}
    </Link>
  );
}
