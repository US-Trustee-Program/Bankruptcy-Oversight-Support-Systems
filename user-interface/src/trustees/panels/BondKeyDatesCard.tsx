import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import { TrusteeUpcomingKeyDates, isoToMMDDYYYY } from '@common/cams/trustee-upcoming-key-dates';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { useOpenEditKeyDates } from './useOpenEditKeyDates';

export interface BondKeyDatesCardProps {
  trusteeId: string;
  appointmentId: string;
  appointmentHeading?: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
}

const NO_DATE = 'No date added';

function formatDateOrDefault(isoDate: string | undefined): string {
  return isoDate ? isoToMMDDYYYY(isoDate) : NO_DATE;
}

export default function BondKeyDatesCard(props: Readonly<BondKeyDatesCardProps>) {
  const { trusteeId, appointmentId, data, isLoading } = props;
  const canManage = useCanManageTrustees();
  const openEdit = useOpenEditKeyDates(trusteeId, appointmentId, 'bond-key-dates');

  if (isLoading) {
    return <LoadingSpinner id="bond-key-dates-loading" />;
  }

  return (
    <EditableTableCard
      id={`edit-bond-key-dates-${appointmentId}`}
      title="Bond"
      testId="bond-key-dates-card"
      tableId={`bond-key-dates-table-${appointmentId}`}
      tableAriaLabel="Bond key dates"
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit bond key dates"
      editTitle="Edit bond key dates"
      columns={[
        { key: 'bondRenewalDate', header: 'Bond Renewal', testId: 'bond-renewal-date' },
        { key: 'bondIssuedDate', header: 'Bond Issued', testId: 'bond-issued-date' },
      ]}
      values={{
        bondRenewalDate: formatDateOrDefault(data?.bondRenewalDate),
        bondIssuedDate: formatDateOrDefault(data?.bondIssuedDate),
      }}
    />
  );
}
