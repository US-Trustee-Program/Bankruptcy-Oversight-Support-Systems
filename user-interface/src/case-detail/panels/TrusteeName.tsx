import { Link } from 'react-router-dom';

export interface TrusteeNameProps {
  trusteeName: string;
  trusteeId?: string | null;
}

/**
 * Displays trustee name as a link to the trustee profile if trusteeId is available,
 * otherwise displays plain text.
 */
export function TrusteeName({ trusteeName, trusteeId }: TrusteeNameProps) {
  if (!trusteeId) return <>{trusteeName}</>;

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
