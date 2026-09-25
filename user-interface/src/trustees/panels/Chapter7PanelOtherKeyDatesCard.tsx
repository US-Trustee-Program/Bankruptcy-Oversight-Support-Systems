import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { useOpenEditKeyDates } from './useOpenEditKeyDates';
import { formatDateOrDefault } from './upcomingKeyDatesFieldConfig';

export interface Chapter7PanelOtherKeyDatesCardProps {
  trusteeId: string;
  appointmentId: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
}

export default function Chapter7PanelOtherKeyDatesCard(
  props: Readonly<Chapter7PanelOtherKeyDatesCardProps>,
) {
  const { trusteeId, appointmentId, data, isLoading } = props;
  const canManage = useCanManageTrustees();
  const openEdit = useOpenEditKeyDates(trusteeId, appointmentId, 'other-key-dates');

  if (isLoading) {
    return <LoadingSpinner id="chapter7-panel-other-key-dates-loading" />;
  }

  return (
    <EditableTableCard
      id={`edit-chapter7-panel-other-key-dates-${appointmentId}`}
      title="Other"
      testId="chapter7-panel-other-key-dates-card"
      className="chapter7-panel-other-key-dates-card"
      tableId={`chapter7-panel-other-key-dates-table-${appointmentId}`}
      tableClassName="chapter7-panel-other-key-dates-table"
      tableAriaLabel="Other key dates"
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit Other key dates"
      editTitle="Edit Other key dates"
      columns={[
        {
          key: 'lastBackgroundQuestionnaire',
          header: 'Last Update to Background Questionnaire',
          testId: 'past-background-question-row',
        },
      ]}
      values={{
        lastBackgroundQuestionnaire: formatDateOrDefault(data?.pastBackgroundQuestion),
      }}
    />
  );
}
