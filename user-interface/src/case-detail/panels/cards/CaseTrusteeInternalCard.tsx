import { ContactInformation } from '@common/cams/contact';
import FormattedContact from '@/lib/components/cams/FormattedContact';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';

interface CaseTrusteeInternalCardProps {
  internalContact?: Partial<ContactInformation>;
}

export default function CaseTrusteeInternalCard({
  internalContact,
}: Readonly<CaseTrusteeInternalCardProps>) {
  return (
    <div
      data-testid="case-trustee-internal-card"
      className="case-trustee-internal-information usa-card"
    >
      <div className="usa-card__container">
        <div className="usa-card__body">
          <h4>Internal</h4>
          <Alert
            message="Internal use only."
            slim={true}
            role="status"
            inline={true}
            show={true}
            type={UswdsAlertStyle.Warning}
          />
          {internalContact ? (
            <FormattedContact contact={internalContact} testIdPrefix="case-trustee-internal" />
          ) : (
            <div data-testid="case-trustee-internal-card-empty">
              No internal contact information.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
