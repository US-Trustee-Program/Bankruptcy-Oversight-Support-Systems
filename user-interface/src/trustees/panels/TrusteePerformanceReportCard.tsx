import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import {
  TrusteeUpcomingKeyDates,
  isoToMMDD,
  isoRangeToMMDD,
} from '@common/cams/trustee-upcoming-key-dates';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { useOpenEditKeyDates } from './useOpenEditKeyDates';
import {
  tprReviewPeriodField,
  tprFrequencyField,
  tprDueField,
  formatDateOrDefault,
  NO_DATE,
  buildCompletionTag,
} from './upcomingKeyDatesFieldConfig';

type TrusteePerformanceReportCardVariant = 'chapter7-panel' | 'chapter12-standing';

const EDIT_ROUTE_SEGMENT: Record<TrusteePerformanceReportCardVariant, string> = {
  'chapter7-panel': 'tpr-key-dates',
  'chapter12-standing': 'chapter12-standing-tpr-key-dates',
};

export interface TrusteePerformanceReportCardProps {
  trusteeId: string;
  appointmentId: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
  tprDisplayUpdates: boolean;
  variant: TrusteePerformanceReportCardVariant;
}

export default function TrusteePerformanceReportCard(
  props: Readonly<TrusteePerformanceReportCardProps>,
) {
  const { trusteeId, appointmentId, data, isLoading, tprDisplayUpdates, variant } = props;
  const canManage = useCanManageTrustees();
  const openEdit = useOpenEditKeyDates(trusteeId, appointmentId, EDIT_ROUTE_SEGMENT[variant]);

  if (isLoading) {
    return <LoadingSpinner id={`${variant}-tpr-loading`} />;
  }

  const tag = buildCompletionTag(
    data?.tprCompletionYear,
    data?.tprCompletionStatus,
    'COMPLETE',
    `tpr-completion-status-tag-${appointmentId}`,
  );

  const columns = [
    {
      key: 'tprReviewPeriod',
      header: 'TPR Review Period',
      testId: `${variant}-tpr-review-period-row`,
    },
    ...(tprDisplayUpdates
      ? [
          {
            key: 'tprFrequency',
            header: 'TPR Review Period Frequency',
            testId: `${variant}-tpr-review-period-frequency-row`,
          },
        ]
      : []),
    { key: 'tprDue', header: 'TPR Due', testId: `${variant}-tpr-due-row` },
    {
      key: 'lastTprSubmitted',
      header: 'Last TPR Submitted',
      testId: `${variant}-last-tpr-submitted-row`,
    },
  ];

  const tprReviewPeriodValue = tprDisplayUpdates
    ? tprReviewPeriodField(data).value
    : data?.tprReviewPeriodStart && data?.tprReviewPeriodEnd
      ? isoRangeToMMDD(data.tprReviewPeriodStart, data.tprReviewPeriodEnd)
      : NO_DATE;

  const tprDueValue = tprDisplayUpdates
    ? tprDueField(data).value
    : data?.tprDue && data?.tprDueYearType
      ? `${isoToMMDD(data.tprDue)} ${data.tprDueYearType}`
      : NO_DATE;

  const values = {
    tprReviewPeriod: tprReviewPeriodValue,
    ...(tprDisplayUpdates ? { tprFrequency: tprFrequencyField(data).value } : {}),
    tprDue: tprDueValue,
    lastTprSubmitted: formatDateOrDefault(data?.lastTprSubmitted),
  };

  return (
    <EditableTableCard
      id={`edit-${variant}-tpr-${appointmentId}`}
      title="Trustee Performance Report"
      testId={`${variant}-tpr-card`}
      className={`${variant}-tpr-card`}
      tableId={`${variant}-tpr-table-${appointmentId}`}
      tableClassName={`${variant}-tpr-table`}
      tableAriaLabel="Trustee Performance Report key dates"
      tag={tag}
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit Trustee Performance Report key dates"
      editTitle="Edit Trustee Performance Report key dates"
      columns={columns}
      values={values}
    />
  );
}
