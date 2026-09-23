import { TrusteeUpcomingKeyDates, isoToMMDDYYYY } from '@common/cams/trustee-upcoming-key-dates';
import Chapter13StandingKeyDatesCard from './Chapter13StandingKeyDatesCard';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { useOpenEditKeyDates } from './useOpenEditKeyDates';
import CompletionStatusTag from './CompletionStatusTag';
import {
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

  const tag =
    data?.ch13TprCompletionYear && data?.ch13TprCompletionStatus ? (
      <CompletionStatusTag
        id="tpr-completion-status"
        status={data.ch13TprCompletionStatus}
        year={data.ch13TprCompletionYear}
      />
    ) : undefined;

  const reviewPeriod = tprReviewPeriodField(data, 'TPR Review Period');
  const frequency = tprFrequencyField(data);
  const due = tprDueField(data, 'TPR Due');

  return (
    <Chapter13StandingKeyDatesCard
      title="Trustee Performance Report"
      tag={tag}
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit Trustee Performance Report key dates"
      editTitle="Edit Trustee Performance Report key dates"
      testId="chapter13-standing-tpr-card"
      fields={[
        { label: reviewPeriod.label, value: reviewPeriod.value, testId: reviewPeriod.testId },
        { label: frequency.label, value: frequency.value, testId: frequency.testId },
        { label: due.label, value: due.value, testId: due.testId },
        {
          label: 'Last TPR Submitted',
          value: data?.pastTprSubmission ? isoToMMDDYYYY(data.pastTprSubmission) : NO_DATE,
          testId: 'last-tpr-submitted-row',
        },
      ]}
    />
  );
}
