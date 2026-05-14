import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';

import InfoCard from '@/trustees/panels/InfoCard';
import FormattedContact from '@/lib/components/cams/FormattedContact';

interface BankruptcySoftwareDetailOverviewProps {
  software: BankruptcySoftwareProfile;
  onEditGeneral: () => void;
  onEditContact: () => void;
}

export function BankruptcySoftwareDetailOverview({
  software,
  onEditGeneral,
  onEditContact,
}: Readonly<BankruptcySoftwareDetailOverviewProps>) {
  const contactForDisplay = software.contact
    ? {
        companyName: software.contact.contactNames?.[0],
        address: software.contact.address,
        phone: software.contact.phone,
        email: software.contact.emails?.[0],
        website: software.contact.website,
      }
    : undefined;

  return (
    <div className="grid-row grid-gap-lg" data-testid="software-detail-overview">
      <div className="grid-col-6">
        <InfoCard
          id="edit-software-general"
          title="General Information"
          onEdit={onEditGeneral}
          fields={[
            { label: 'Name', value: software.name },
            { label: 'Status', value: software.status === 'active' ? 'Active' : 'Inactive' },
          ]}
        />
      </div>
      <div className="grid-col-6">
        <InfoCard
          id="edit-software-contact"
          title="Vendor Contact Info."
          onEdit={onEditContact}
          fields={[
            {
              label: '',
              value: contactForDisplay ? (
                <FormattedContact contact={contactForDisplay} showLinks={true} />
              ) : (
                <span data-testid="no-contact-info">(none)</span>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
