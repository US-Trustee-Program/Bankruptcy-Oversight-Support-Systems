import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import {
  TrusteeUpcomingKeyDates,
  isoToMMDD,
  isoRangeToMMDD,
} from '@common/cams/trustee-upcoming-key-dates';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import {
  tprReviewPeriodField,
  tprFrequencyField,
  tprDueField,
  formatDateOrDefault,
  NO_DATE,
} from './upcomingKeyDatesFieldConfig';

export interface Chapter7PanelTrusteePerformanceReportCardProps {
  trusteeId: string;
  appointmentId: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
  tprDisplayUpdates: boolean;
}

export default function Chapter7PanelTrusteePerformanceReportCard(
  props: Readonly<Chapter7PanelTrusteePerformanceReportCardProps>,
) {
  const { trusteeId, appointmentId, data, isLoading, tprDisplayUpdates } = props;
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

  const columns = [
    { key: 'tprReviewPeriod', header: 'TPR Review Period', testId: 'tpr-review-period-row' },
    ...(tprDisplayUpdates
      ? [
          {
            key: 'tprFrequency',
            header: 'TPR Review Period Frequency',
            testId: 'tpr-review-period-frequency-row',
          },
        ]
      : []),
    { key: 'tprDue', header: 'TPR Due', testId: 'tpr-due-row' },
    {
      key: 'lastTprSubmitted',
      header: 'Last TPR Submitted',
      testId: 'last-tpr-submitted-row',
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
      columns={columns}
      values={values}
    />
  );
}
