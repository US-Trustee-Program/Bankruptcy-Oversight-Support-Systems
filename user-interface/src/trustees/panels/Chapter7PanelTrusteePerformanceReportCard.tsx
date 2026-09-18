import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import {
  tprReviewPeriodField,
  tprFrequencyField,
  tprDueField,
  formatDateOrDefault,
} from './upcomingKeyDatesFieldConfig';

export interface Chapter7PanelTrusteePerformanceReportCardProps {
  trusteeId: string;
  appointmentId: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
}

export default function Chapter7PanelTrusteePerformanceReportCard(
  props: Readonly<Chapter7PanelTrusteePerformanceReportCardProps>,
) {
  const { trusteeId, appointmentId, data, isLoading } = props;
  const navigate = useNavigate();
  const canManage = useCanManageTrustees();

  function openEdit() {
    navigate(`/trustees/${trusteeId}/appointments/${appointmentId}/tpr-key-dates/edit`);
  }

  if (isLoading) {
    return <LoadingSpinner id="chapter7-panel-tpr-loading" />;
  }

  const tag =
    data?.tprCompletionYear !== undefined && data?.tprCompletionStatus !== undefined
      ? {
          label: `${data.tprCompletionStatus === 'COMPLETE' ? 'Complete' : 'Incomplete'} for ${data.tprCompletionYear}`,
          color: (data.tprCompletionStatus === 'COMPLETE' ? 'green' : 'red') as 'green' | 'red',
          id: `tpr-completion-status-tag-${appointmentId}`,
        }
      : undefined;

  return (
    <EditableTableCard
      id={`edit-chapter7-panel-tpr-${appointmentId}`}
      title="Trustee Performance Report"
      testId="chapter7-panel-tpr-card"
      className="chapter7-panel-tpr-card"
      tableId={`chapter7-panel-tpr-table-${appointmentId}`}
      tableClassName="chapter7-panel-tpr-table"
      tableAriaLabel="Trustee Performance Report key dates"
      tag={tag}
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit Trustee Performance Report key dates"
      editTitle="Edit Trustee Performance Report key dates"
      columns={[
        { key: 'tprReviewPeriod', header: 'TPR Review Period', testId: 'tpr-review-period-row' },
        {
          key: 'tprFrequency',
          header: 'TPR Review Period Frequency',
          testId: 'tpr-review-period-frequency-row',
        },
        { key: 'tprDue', header: 'TPR Due', testId: 'tpr-due-row' },
        {
          key: 'lastTprSubmitted',
          header: 'Last TPR Submitted',
          testId: 'last-tpr-submitted-row',
        },
      ]}
      values={{
        tprReviewPeriod: tprReviewPeriodField(data).value,
        tprFrequency: tprFrequencyField(data).value,
        tprDue: tprDueField(data).value,
        lastTprSubmitted: formatDateOrDefault(data?.lastTprSubmitted),
      }}
    />
  );
}
