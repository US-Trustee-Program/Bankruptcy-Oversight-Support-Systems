import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import { BankProfile } from '@common/cams/banks';

import InfoCard from '@/trustees/panels/InfoCard';
import FormattedContact from '@/lib/components/cams/FormattedContact';
import { AssociatedBanksTable } from './AssociatedBanksTable';

interface BankruptcySoftwareDetailOverviewProps {
  software: BankruptcySoftwareProfile;
  banks: BankProfile[];
  onEditGeneral: () => void;
  onEditContact: () => void;
  onAddBank: (bankId: string, bankName: string) => void;
  onEditBankStatus: (
    bankId: string,
    bankName: string,
    currentStatus: 'active' | 'inactive',
  ) => void;
}

export function BankruptcySoftwareDetailOverview({
  software,
  banks,
  onEditGeneral,
  onEditContact,
  onAddBank,
  onEditBankStatus,
}: Readonly<BankruptcySoftwareDetailOverviewProps>) {
  const contact = software.contact;

  const addressForDisplay = contact?.address
    ? {
        address: contact.address,
      }
    : undefined;

  const commsForDisplay =
    contact?.phone || contact?.emails?.[0] || contact?.website
      ? {
          phone: contact.phone,
          email: contact.emails?.[0],
          website: contact.website,
        }
      : undefined;

  const contactFields = [];
  if (contact?.contactNames?.[0]) {
    contactFields.push({ label: 'Contact Name', value: contact.contactNames[0] });
  }
  if (addressForDisplay) {
    contactFields.push({
      label: 'Contact Address',
      value: <FormattedContact contact={addressForDisplay} showLinks={false} />,
    });
  }
  if (commsForDisplay) {
    contactFields.push({
      label: '',
      value: <FormattedContact contact={commsForDisplay} showLinks={true} />,
    });
  }
  if (contactFields.length === 0) {
    contactFields.push({ label: '', value: <span data-testid="no-contact-info">(none)</span> });
  }

  return (
    <div className="software-detail-overview" data-testid="software-detail-overview">
      <div className="software-detail-info-cards">
        <InfoCard
          id="edit-software-general"
          title="General Information"
          onEdit={onEditGeneral}
          fields={[
            { label: 'Name', value: software.name },
            { label: 'Status', value: software.status === 'active' ? 'Active' : 'Inactive' },
          ]}
        />
        <InfoCard
          id="edit-software-contact"
          title="Vendor Contact Info."
          onEdit={onEditContact}
          fields={contactFields}
        />
      </div>
      <AssociatedBanksTable
        associations={software.associatedBanks ?? []}
        allBanks={banks}
        onAddBank={onAddBank}
        onEditStatus={onEditBankStatus}
      />
    </div>
  );
}
