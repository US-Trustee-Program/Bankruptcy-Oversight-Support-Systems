import { BankProfile } from '@common/cams/banks';
import InfoCard from '@/trustees/panels/InfoCard';

interface BankDetailOverviewProps {
  bank: BankProfile;
  onEdit: () => void;
}

export function BankDetailOverview({ bank, onEdit }: Readonly<BankDetailOverviewProps>) {
  return (
    <InfoCard
      id="edit-bank"
      title="General Information"
      onEdit={onEdit}
      fields={[
        { label: 'Name', value: bank.name },
        { label: 'Status', value: bank.status === 'active' ? 'Active' : 'Inactive' },
      ]}
    />
  );
}
