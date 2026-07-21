import './ContactInformationCard.scss';
import { PHONE_TYPES, PHONE_TYPE_LABELS, TrusteeInternalContact } from '@common/cams/trustees';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import FormattedContact from '@/lib/components/cams/FormattedContact';
import CommsLink from '@/lib/components/cams/CommsLink/CommsLink';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { ContactWithPartialPhoneAndAddress } from '@common/cams/contact';

interface ContactInformationCardProps {
  internalContact?: TrusteeInternalContact;
  onEdit?: () => void;
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
              <>
                <FormattedContact
                  contact={
                    { ...internalContact, phones: undefined } as ContactWithPartialPhoneAndAddress
                  }
                  testIdPrefix="trustee-internal"
                />
                {internalContact.phones && internalContact.phones.length > 0 && (
                  <div data-testid="trustee-internal-phones">
                    {PHONE_TYPES.map((type) => {
                      const p = internalContact.phones!.find((ph) => ph.type === type);
                      if (!p?.number) return null;
                      return (
                        <div
                          key={type}
                          className="phone"
                          data-testid={`trustee-internal-phone-${type}`}
                        >
                          <CommsLink contact={{ phone: p }} mode="phone-dialer" />
                          <span>{`(${PHONE_TYPE_LABELS[type]})`}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
