import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { buildCompletionTag } from './completionTag';
import {
  formatLastTprSubmitted,
  formatTprDue,
  formatTprFrequency,
  formatTprReviewPeriod,
} from './tprFieldFormatters';

export interface TrusteePerformanceReportKeyDatesCardProps {
  trusteeId: string;
  appointmentId: string;
  appointmentHeading?: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
}

export default function TrusteePerformanceReportKeyDatesCard(
  props: Readonly<TrusteePerformanceReportKeyDatesCardProps>,
) {
  const { trusteeId, appointmentId, appointmentHeading, data, isLoading } = props;
  const navigate = useNavigate();
  const canManage = useCanManageTrustees();

  function openEdit() {
    navigate(`/trustees/${trusteeId}/appointments/${appointmentId}/tpr-key-dates/edit`, {
      state: { subHeading: appointmentHeading ?? '' },
    });
  }

  if (isLoading) {
    return <LoadingSpinner id={`tpr-key-dates-loading-${appointmentId}`} />;
  }

  return (
    <EditableTableCard
      id={`edit-tpr-key-dates-${appointmentId}`}
      title="Trustee Performance Report"
      testId={`tpr-key-dates-card-${appointmentId}`}
      className="tpr-key-dates-card"
      tableId={`tpr-key-dates-table-${appointmentId}`}
      tableClassName="tpr-key-dates-table"
      tableAriaLabel="Trustee Performance Report key dates"
      tag={buildCompletionTag(
        `tpr-completion-status-${appointmentId}`,
        data?.tprCompletionYear,
        data?.tprCompletionStatus,
      )}
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit Trustee Performance Report key dates"
      editTitle="Edit Trustee Performance Report key dates"
      columns={[
        { key: 'tprReviewPeriod', header: 'TPR Review Period', testId: 'tpr-review-period' },
        { key: 'tprFrequency', header: 'TPR Review Period Frequency', testId: 'tpr-frequency' },
        { key: 'tprDue', header: 'TPR Due', testId: 'tpr-due' },
        { key: 'lastTprSubmitted', header: 'Last TPR Submitted', testId: 'last-tpr-submitted' },
      ]}
      values={{
        tprReviewPeriod: formatTprReviewPeriod(data),
        tprFrequency: formatTprFrequency(data),
        tprDue: formatTprDue(data),
        lastTprSubmitted: formatLastTprSubmitted(data),
      }}
    />
  );
}
