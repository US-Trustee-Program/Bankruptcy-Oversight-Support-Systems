import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { buildCompletionTag } from './upcomingKeyDatesFieldConfig';

export interface AnnualReportKeyDatesCardProps {
  trusteeId: string;
  appointmentId: string;
  appointmentHeading?: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
}

// Fixed for Chapter 12 and 13 Case by Case appointments — not user-entered.
const ANNUAL_REPORT_SUBMISSION = '09/01';
const ANNUAL_REPORT_DUE_TO_OO = '09/15';

export default function AnnualReportKeyDatesCard(props: Readonly<AnnualReportKeyDatesCardProps>) {
  const { trusteeId, appointmentId, appointmentHeading, data, isLoading } = props;
  const navigate = useNavigate();
  const canManage = useCanManageTrustees();

  function openEdit() {
    navigate(
      `/trustees/${trusteeId}/appointments/${appointmentId}/ch12-13-annual-report-key-dates/edit`,
      {
        state: { subHeading: appointmentHeading ?? '' },
      },
    );
  }

  if (isLoading) {
    return <LoadingSpinner id={`annual-report-key-dates-loading-${appointmentId}`} />;
  }

  return (
    <EditableTableCard
      id={`edit-annual-report-key-dates-${appointmentId}`}
      title="Annual Report"
      testId={`annual-report-key-dates-card-${appointmentId}`}
      className="annual-report-key-dates-card"
      tableId={`annual-report-key-dates-table-${appointmentId}`}
      tableClassName="annual-report-key-dates-table"
      tableAriaLabel="Annual Report key dates"
      tag={buildCompletionTag(
        data?.annualReportCompletionYear,
        data?.annualReportCompletionStatus,
        'COMPLETE',
        `annual-report-completion-status-${appointmentId}`,
      )}
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit Annual Report key dates"
      editTitle="Edit Annual Report key dates"
      columns={[
        {
          key: 'annualReportSubmission',
          header: 'Annual Report Submission',
          testId: 'annual-report-submission',
        },
        {
          key: 'annualReportDueToOO',
          header: 'Annual Report Due to OO',
          testId: 'annual-report-due-oo',
        },
      ]}
      values={{
        annualReportSubmission: ANNUAL_REPORT_SUBMISSION,
        annualReportDueToOO: ANNUAL_REPORT_DUE_TO_OO,
      }}
    />
  );
}
