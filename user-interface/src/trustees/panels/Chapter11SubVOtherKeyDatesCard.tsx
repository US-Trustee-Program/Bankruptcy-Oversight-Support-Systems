import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import { TrusteeUpcomingKeyDates, isoToMMDDYYYY } from '@common/cams/trustee-upcoming-key-dates';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { useOpenEditKeyDates } from './useOpenEditKeyDates';

export interface Chapter11SubVOtherKeyDatesCardProps {
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

export default function Chapter11SubVOtherKeyDatesCard(
  props: Readonly<Chapter11SubVOtherKeyDatesCardProps>,
) {
  const { trusteeId, appointmentId, data, isLoading } = props;
  const canManage = useCanManageTrustees();
  const openEdit = useOpenEditKeyDates(trusteeId, appointmentId, 'chapter11-subv-other-key-dates');

  if (isLoading) {
    return <LoadingSpinner id="subv-other-key-dates-loading" />;
  }

  return (
    <EditableTableCard
      id={`edit-subv-other-key-dates-${appointmentId}`}
      title="Other"
      testId="subv-other-key-dates-card"
      tableId={`subv-other-key-dates-table-${appointmentId}`}
      tableAriaLabel="Other key dates"
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit Other Key Dates"
      editTitle="Edit Other Key Dates"
      columns={[
        {
          key: 'lastMonthlyReportReceived',
          header: 'Last Monthly Report Received',
          testId: 'past-last-monthly-report-received-row',
        },
      ]}
      values={{
        lastMonthlyReportReceived: formatDateOrDefault(data?.lastMonthlyReportReceived),
      }}
    />
  );
}
