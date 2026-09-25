import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { useOpenEditKeyDates } from './useOpenEditKeyDates';
import {
  buildCompletionTag,
  formatDateOrDefault,
  NO_DATE,
  tprDueField,
  tprFrequencyField,
  tprReviewPeriodField,
} from './upcomingKeyDatesFieldConfig';
import { isoToMMDD, isoRangeToMMDD } from '@common/cams/trustee-upcoming-key-dates';

export interface TrusteePerformanceReportKeyDatesCardProps {
  trusteeId: string;
  appointmentId: string;
  appointmentHeading?: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
  tprDisplayUpdates: boolean;
}

export default function TrusteePerformanceReportKeyDatesCard(
  props: Readonly<TrusteePerformanceReportKeyDatesCardProps>,
) {
  const { trusteeId, appointmentId, data, isLoading, tprDisplayUpdates } = props;
  const canManage = useCanManageTrustees();
  const openEdit = useOpenEditKeyDates(trusteeId, appointmentId, 'ch12-13-tpr-key-dates');

  if (isLoading) {
    return <LoadingSpinner id={`tpr-key-dates-loading-${appointmentId}`} />;
  }

  // Mirrors Chapter7PanelTrusteePerformanceReportCard: with the flag off the
  // frequency column is hidden and the period and due date use the legacy
  // formats, so the rollout stays consistent across appointment types.
  const columns = [
    { key: 'tprReviewPeriod', header: 'TPR Review Period', testId: 'tpr-review-period' },
    ...(tprDisplayUpdates
      ? [
          {
            key: 'tprFrequency',
            header: 'TPR Review Period Frequency',
            testId: 'tpr-frequency',
          },
        ]
      : []),
    { key: 'tprDue', header: 'TPR Due', testId: 'tpr-due' },
    { key: 'lastTprSubmitted', header: 'Last TPR Submitted', testId: 'last-tpr-submitted' },
  ];

  const values = {
    tprReviewPeriod: tprDisplayUpdates
      ? tprReviewPeriodField(data).value
      : data?.tprReviewPeriodStart && data?.tprReviewPeriodEnd
        ? isoRangeToMMDD(data.tprReviewPeriodStart, data.tprReviewPeriodEnd)
        : NO_DATE,
    ...(tprDisplayUpdates ? { tprFrequency: tprFrequencyField(data).value } : {}),
    tprDue: tprDisplayUpdates
      ? tprDueField(data).value
      : data?.tprDue && data?.tprDueYearType
        ? `${isoToMMDD(data.tprDue)} ${data.tprDueYearType}`
        : NO_DATE,
    // CAMS-912 added lastTprSubmitted as a field distinct from the
    // pastTprSubmission used by the Chapter 7 Panel past-dates card.
    lastTprSubmitted: formatDateOrDefault(data?.lastTprSubmitted),
  };

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
        data?.tprCompletionYear,
        data?.tprCompletionStatus,
        'COMPLETE',
        `tpr-completion-status-${appointmentId}`,
      )}
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit Trustee Performance Report key dates"
      editTitle="Edit Trustee Performance Report key dates"
      columns={columns}
      values={values}
    />
  );
}
