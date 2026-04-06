import { useTrustee } from '../useTrustee';
import { TrusteeName } from '../TrusteeName';

interface CaseTrusteeCardProps {
  trusteeId?: string;
}

export default function CaseTrusteeCard({ trusteeId }: Readonly<CaseTrusteeCardProps>) {
  const { trustee, loading } = useTrustee(trusteeId);

  return (
    <div data-testid="case-trustee-card" className="case-trustee-information usa-card">
      <div className="usa-card__container">
        <div className="usa-card__body">
          <h4>Trustee</h4>
          {!trusteeId && <div data-testid="case-trustee-card-empty">No trustee appointed.</div>}
          {trusteeId && loading && (
            <div data-testid="case-trustee-card-loading">Loading trustee information...</div>
          )}
          {trusteeId && !loading && trustee && (
            <div data-testid="case-trustee-card-name">
              <TrusteeName trusteeName={trustee.name} trusteeId={trusteeId} />
            </div>
          )}
          {trusteeId && !loading && !trustee && (
            <div data-testid="case-trustee-card-empty">No trustee information available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
