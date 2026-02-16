import './ContactInformationCard.scss';
import { ContactInformation } from '@common/cams/contact';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import FormattedContact from '@/lib/components/cams/FormattedContact';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';

interface ContactInformationCardProps {
  internalContact?: Partial<ContactInformation>;
  onEdit: () => void;
}

export default function ContactInformationCard({
  internalContact,
  onEdit,
}: Readonly<ContactInformationCardProps>) {
  return (
    <div className="contact-information-card-container">
      <div className="contact-information-card usa-card">
        <div className="usa-card__container">
          <div className="usa-card__body">
            <div className="contact-information-card-header">
              <h4>Internal</h4>
              <Button
                id="edit-internal-profile"
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Edit trustee internal contact information"
                title="Edit trustee contact information"
                onClick={onEdit}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
            </div>
            <Alert
              message={'Internal use only.'}
              slim={true}
              role={'status'}
              inline={true}
              show={true}
              type={UswdsAlertStyle.Warning}
            ></Alert>
            {!internalContact && (
              <div data-testid="no-internal-information">No information added.</div>
            )}
            {!!internalContact && (
              <FormattedContact contact={internalContact} testIdPrefix="trustee-internal" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
