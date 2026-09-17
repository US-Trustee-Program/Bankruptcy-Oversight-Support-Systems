import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import { TrusteeUpcomingKeyDates, isoToMMDDYYYY } from '@common/cams/trustee-upcoming-key-dates';
import {
  tirReviewPeriodField,
  tirSubmissionField,
  tirReviewField,
} from './upcomingKeyDatesFieldConfig';

export interface Chapter7PanelTrusteeInterimReportCardProps {
  trusteeId: string;
  appointmentId: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
}

const NO_DATE = 'No date added';

function formatDateOrDefault(isoDate: string | undefined): string {
  return isoDate ? isoToMMDDYYYY(isoDate) : NO_DATE;
}

export default function Chapter7PanelTrusteeInterimReportCard(
  props: Readonly<Chapter7PanelTrusteeInterimReportCardProps>,
) {
  const { appointmentId, data, isLoading } = props;

  if (isLoading) {
    return <LoadingSpinner id="chapter7-panel-tir-loading" />;
  }

  return (
    <EditableTableCard
      id={`chapter7-panel-tir-${appointmentId}`}
      title="Trustee Interim Report"
      testId="chapter7-panel-tir-card"
      className="chapter7-panel-tir-card"
      tableId={`chapter7-panel-tir-table-${appointmentId}`}
      tableClassName="chapter7-panel-tir-table"
      tableAriaLabel="Trustee Interim Report key dates"
      columns={[
        { key: 'tirReviewPeriod', header: 'TIR Review Period', testId: 'tir-review-period-row' },
        { key: 'tirSubmission', header: 'TIR Submission', testId: 'tir-submission-row' },
        { key: 'tirDue', header: 'TIR Due', testId: 'tir-review-row' },
        { key: 'tirLetter', header: 'TIR Letter', testId: 'past-tpr-submission-row' },
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
