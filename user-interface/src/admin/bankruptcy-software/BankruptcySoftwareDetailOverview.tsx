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
    <>
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
      <div className="grid-row grid-gap-lg margin-top-4">
        <div className="grid-col-12">
          <AssociatedBanksTable
            associations={software.associatedBanks ?? []}
            allBanks={banks}
            onAddBank={onAddBank}
            onEditStatus={onEditBankStatus}
          />
        </div>
      </div>
    </>
  );
}
