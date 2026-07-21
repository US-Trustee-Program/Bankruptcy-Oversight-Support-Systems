import './ContactInformationCard.scss';
import { TrusteeInternalContact } from '@common/cams/trustees';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import FormattedContact from '@/lib/components/cams/FormattedContact';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { ContactWithPartialPhoneAndAddress } from '@common/cams/contact';
import useFeatureFlags, { TRUSTEE_TYPED_PHONES } from '@/lib/hooks/UseFeatureFlags';

interface ContactInformationCardProps {
  internalContact?: TrusteeInternalContact;
  onEdit?: () => void;
}

export default function ContactInformationCard({
  internalContact,
  onEdit,
}: Readonly<ContactInformationCardProps>) {
  const flags = useFeatureFlags();
  const typedPhonesEnabled = flags[TRUSTEE_TYPED_PHONES] === true;

  const directPhone = internalContact?.phones?.find((p) => p.type === 'direct');
  let phones;
  if (typedPhonesEnabled) {
    phones = internalContact?.phones;
  } else if (directPhone) {
    phones = [directPhone];
  }

  return (
    <div className="contact-information-card-container">
      <div className="contact-information-card usa-card">
        <div className="usa-card__container">
          <div className="usa-card__body">
            <div className="contact-information-card-header">
              <h4>Internal Contact Info</h4>
              {onEdit && (
                <Button
                  id="edit-internal-profile"
                  uswdsStyle={UswdsButtonStyle.Unstyled}
                  aria-label="Edit trustee internal contact information"
                  title="Edit trustee contact information"
                  onClick={onEdit}
                >
                  <IconLabel icon="edit" label="Edit" />
                </Button>
              )}
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
              <FormattedContact
                contact={
                  { ...internalContact, phones: undefined } as ContactWithPartialPhoneAndAddress
                }
                phones={phones}
                testIdPrefix="trustee-internal"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
