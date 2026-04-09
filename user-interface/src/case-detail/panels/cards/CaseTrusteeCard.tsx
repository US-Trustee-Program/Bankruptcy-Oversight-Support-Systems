import './CaseTrusteeCard.scss';
import { Trustee } from '@common/cams/trustees';
import { TrusteeName } from '../TrusteeName';
import FormattedContact from '@/lib/components/cams/FormattedContact';

interface CaseTrusteeCardProps {
  trustee: Trustee;
  trusteeId: string;
}

export default function CaseTrusteeCard({ trustee, trusteeId }: Readonly<CaseTrusteeCardProps>) {
  return (
    <div data-testid="case-trustee-card" className="case-trustee-information usa-card">
      <div className="usa-card__container">
        <div className="usa-card__body">
          <h4>Public Contact Info</h4>
          <div data-testid="case-trustee-card-name">
            <TrusteeName trusteeName={trustee.name} trusteeId={trusteeId} openNewTab />
          </div>
          <div data-testid="case-trustee-public-contact">
            <FormattedContact contact={trustee.public} testIdPrefix="case-trustee-public" />
          </div>
        </div>
      </div>
    </div>
  );
}
