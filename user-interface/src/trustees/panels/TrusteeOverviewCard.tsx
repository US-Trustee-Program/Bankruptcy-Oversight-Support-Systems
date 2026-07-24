import './TrusteeOverviewCard.scss';
import { Trustee } from '@common/cams/trustees';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import FormattedContact from '@/lib/components/cams/FormattedContact';
import { TrusteeName } from '@/case-detail/panels/TrusteeName';

interface TrusteeOverviewCardProps {
  trustee: Trustee;
  trusteeId?: string;
  onEdit?: () => void;
  headerText?: string;
  testIdPrefix?: string;
}

export default function TrusteeOverviewCard({
  trustee,
  trusteeId,
  onEdit,
  headerText = 'Public',
  testIdPrefix = 'trustee',
}: Readonly<TrusteeOverviewCardProps>) {
  const editButtonId = `edit-${testIdPrefix}-${headerText.toLowerCase().replace(/\s+/g, '-')}-profile`;
  const editAriaLabel = `Edit trustee ${headerText.toLowerCase()} overview information`;
  const editTitle = `Edit trustee ${headerText.toLowerCase()} contact information`;

  return (
    <div className="trustee-overview-card-container">
      <div className="trustee-overview-card usa-card">
        <div className="usa-card__container">
          <div className="usa-card__body">
            <div className="trustee-overview-card-header">
              <h4>{headerText}</h4>
              {onEdit && (
                <Button
                  id={editButtonId}
                  uswdsStyle={UswdsButtonStyle.Unstyled}
                  aria-label={editAriaLabel}
                  title={editTitle}
                  onClick={onEdit}
                >
                  <IconLabel icon="edit" label="Edit" />
                </Button>
              )}
            </div>
            <div className="trustee-name" data-testid="trustee-name">
              {trusteeId ? (
                <TrusteeName trusteeName={trustee.name} trusteeId={trusteeId} openNewTab />
              ) : (
                trustee.name
              )}
            </div>
            <FormattedContact
              contact={trustee.public}
              phones={trustee.public.phone ? [trustee.public.phone] : undefined}
              testIdPrefix={testIdPrefix}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
