import './ContactInformationCard.scss';
import { TrusteeInternalContact } from '@common/cams/trustees';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import FormattedContact from '@/lib/components/cams/FormattedContact';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { ContactWithPartialPhoneAndAddress } from '@common/cams/contact';

const PHONE_TYPE_LABELS: Record<string, string> = {
  direct: 'Direct',
  cell: 'Cell',
  home: 'Home',
};

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
                {internalContact.phones && internalContact.phones.length > 0 && (
                  <ul className="typed-phone-list" data-testid="trustee-internal-phones">
                    {internalContact.phones.map((p) => (
                      <li key={p.type} data-testid={`trustee-internal-phone-${p.type}`}>
                        <span className="phone-type-label">
                          {PHONE_TYPE_LABELS[p.type] ?? p.type}:{' '}
                        </span>
                        {p.number}
                        {p.extension ? ` x${p.extension}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
                <FormattedContact
                  contact={
                    { ...internalContact, phones: undefined } as ContactWithPartialPhoneAndAddress
                  }
                  testIdPrefix="trustee-internal"
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
