import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import {
  tirReviewPeriodField,
  tirSubmissionField,
  tirReviewField,
  formatDateOrDefault,
  buildCompletionTag,
} from './upcomingKeyDatesFieldConfig';

export interface Chapter7PanelTrusteeInterimReportCardProps {
  trusteeId: string;
  appointmentId: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
}

export default function Chapter7PanelTrusteeInterimReportCard(
  props: Readonly<Chapter7PanelTrusteeInterimReportCardProps>,
) {
  const { trusteeId, appointmentId, data, isLoading } = props;
  const navigate = useNavigate();
  const canManage = useCanManageTrustees();

  function openEdit() {
    navigate(`/trustees/${trusteeId}/appointments/${appointmentId}/tir-key-dates/edit`);
  }

  if (isLoading) {
    return <LoadingSpinner id="chapter7-panel-tir-loading" />;
  }

  const tag = buildCompletionTag(
    data?.tirCompletionYear,
    data?.tirCompletionStatus,
    'COMPLETE',
    `tir-completion-status-tag-${appointmentId}`,
  );

  return (
    <EditableTableCard
      id={`edit-chapter7-panel-tir-${appointmentId}`}
      title="Trustee Interim Report"
      testId="chapter7-panel-tir-card"
      className="chapter7-panel-tir-card"
      tableId={`chapter7-panel-tir-table-${appointmentId}`}
      tableClassName="chapter7-panel-tir-table"
      tableAriaLabel="Trustee Interim Report key dates"
      tag={tag}
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit Trustee Interim Report key dates"
      editTitle="Edit Trustee Interim Report key dates"
      columns={[
        { key: 'tirReviewPeriod', header: 'TIR Review Period', testId: 'tir-review-period-row' },
        { key: 'tirSubmission', header: 'TIR Submission', testId: 'tir-submission-row' },
        // Column key/testId is 'tirDue'/'tir-review-row' because the underlying data field is
        // tirReview, but the domain calls this date "TIR Due" -- the header label is intentional.
        { key: 'tirDue', header: 'TIR Due', testId: 'tir-review-row' },
        { key: 'tirLetter', header: 'Last TIR Letter', testId: 'last-tir-letter-row' },
      ]}
      values={{
        tirReviewPeriod: tirReviewPeriodField(data).value,
        tirSubmission: tirSubmissionField(data).value,
        tirDue: tirReviewField(data).value,
        tirLetter: formatDateOrDefault(data?.pastTprSubmission),
      }}
    />
  );
}
