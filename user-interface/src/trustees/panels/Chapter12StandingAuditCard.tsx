import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import {
  auditReqByField,
  formatDateOrDefault,
  NO_DATE,
  buildCompletionTag,
} from './upcomingKeyDatesFieldConfig';

export interface Chapter12StandingAuditCardProps {
  trusteeId: string;
  appointmentId: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
}

function formatYearOrDefault(year: number | undefined): string {
  return year !== undefined ? year.toString() : NO_DATE;
}

export default function Chapter12StandingAuditCard(
  props: Readonly<Chapter12StandingAuditCardProps>,
) {
  const { trusteeId, appointmentId, data, isLoading } = props;
  const navigate = useNavigate();
  const canManage = useCanManageTrustees();

  function openEdit() {
    navigate(`/trustees/${trusteeId}/appointments/${appointmentId}/audit-key-dates/edit`);
  }

  if (isLoading) {
    return <LoadingSpinner id="chapter12-standing-audit-loading" />;
  }

  const tag = buildCompletionTag(
    data?.auditCompletionYear,
    data?.auditCompletionStatus,
    'CLOSED',
    `audit-completion-status-tag-${appointmentId}`,
    { closed: 'Closed', notClosed: 'Not Closed' },
  );

  return (
    <EditableTableCard
      id={`edit-chapter12-standing-audit-${appointmentId}`}
      title="Audit"
      testId="chapter12-standing-audit-card"
      className="chapter12-standing-audit-card"
      tableId={`chapter12-standing-audit-table-${appointmentId}`}
      tableClassName="chapter12-standing-audit-table"
      tableAriaLabel="Audit key dates"
      tag={tag}
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit Audit key dates"
      editTitle="Edit Audit key dates"
      columns={[
        {
          key: 'auditReqBy',
          header: 'Audit Recommended by',
          testId: 'audit-req-by-row',
        },
        {
          key: 'lastAuditReport',
          header: 'Last Audit Report Date',
          testId: 'past-audit-row',
        },
        {
          key: 'lastAuditFiscalYear',
          header: "Last Audit's Fiscal Year",
          testId: 'past-last-audit-fiscal-year-row',
        },
      ]}
      values={{
        auditReqBy: auditReqByField(data).value,
        lastAuditReport: formatDateOrDefault(data?.pastAudit),
        lastAuditFiscalYear: formatYearOrDefault(data?.lastAuditFiscalYear),
      }}
    />
  );
}
