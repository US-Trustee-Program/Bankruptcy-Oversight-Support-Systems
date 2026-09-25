import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import { TrusteeUpcomingKeyDates, isoToMMDDYYYY } from '@common/cams/trustee-upcoming-key-dates';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { useOpenEditKeyDates } from './useOpenEditKeyDates';
import {
  buildCompletionTag,
  tprReviewPeriodField,
  tprFrequencyField,
  tprDueField,
  NO_DATE,
} from './upcomingKeyDatesFieldConfig';

export interface Chapter13StandingTrusteePerformanceReportCardProps {
  trusteeId: string;
  appointmentId: string;
  data: TrusteeUpcomingKeyDates | null;
}

export default function Chapter13StandingTrusteePerformanceReportCard(
  props: Readonly<Chapter13StandingTrusteePerformanceReportCardProps>,
) {
  const { trusteeId, appointmentId, data } = props;
  const canManage = useCanManageTrustees();
  const openEdit = useOpenEditKeyDates(
    trusteeId,
    appointmentId,
    'chapter13-standing-tpr-key-dates',
  );

  const tag = buildCompletionTag(
    data?.ch13TprCompletionYear,
    data?.ch13TprCompletionStatus,
    'Complete',
    'tpr-completion-status',
  );

  return (
    <EditableTableCard
      id={`edit-chapter13-standing-tpr-${appointmentId}`}
      title="Trustee Performance Report"
      testId="chapter13-standing-tpr-card"
      className="chapter13-standing-tpr-card"
      tableId={`chapter13-standing-tpr-table-${appointmentId}`}
      tableClassName="chapter13-standing-tpr-table"
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
        tprReviewPeriod: tprReviewPeriodField(data, 'TPR Review Period').value,
        tprFrequency: tprFrequencyField(data).value,
        tprDue: tprDueField(data, 'TPR Due').value,
        lastTprSubmitted: data?.pastTprSubmission ? isoToMMDDYYYY(data.pastTprSubmission) : NO_DATE,
      }}
    />
  );
}
