import './TrusteeOverviewCard.scss';
import { computeTrusteeName, Trustee } from '@common/cams/trustees';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import FormattedContact from '@/lib/components/cams/FormattedContact';

interface TrusteeOverviewCardProps {
  trustee: Trustee;
  onEdit: () => void;
}

export default function TrusteeOverviewCard({
  trustee,
  onEdit,
}: Readonly<TrusteeOverviewCardProps>) {
  return (
    <div className="trustee-overview-card-container">
      <div className="trustee-overview-card usa-card">
        <div className="usa-card__container">
          <div className="usa-card__body">
            <div className="trustee-overview-card-header">
              <h4>Public</h4>
              <Button
                id="edit-public-profile"
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Edit trustee public overview information"
                title="Edit trustee contact information"
                onClick={onEdit}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
            </div>
            <div className="trustee-name" data-testid="trustee-name">
              {trustee.firstName || trustee.lastName
                ? computeTrusteeName(trustee.firstName, trustee.middleName, trustee.lastName)
                : trustee.name}
            </div>
            <FormattedContact contact={trustee.public} testIdPrefix="trustee" />
          </div>
        </div>
      </div>
    </div>
  );
}
