import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { useOpenEditKeyDates } from './useOpenEditKeyDates';
import { buildCompletionTag, formatDateOrDefault } from './upcomingKeyDatesFieldConfig';

export interface Chapter13StandingAuditCardProps {
  trusteeId: string;
  appointmentId: string;
  data: TrusteeUpcomingKeyDates | null;
}

const ANNUAL_AUDIT_PERIOD = '10/01 - 09/30';

export default function Chapter13StandingAuditCard(
  props: Readonly<Chapter13StandingAuditCardProps>,
) {
  const { trusteeId, appointmentId, data } = props;
  const canManage = useCanManageTrustees();
  const openEdit = useOpenEditKeyDates(
    trusteeId,
    appointmentId,
    'chapter13-standing-audit-key-dates',
  );

  const tag = buildCompletionTag(
    data?.ch13AuditCompletionYear,
    data?.ch13AuditCompletionStatus,
    'Complete',
    'audit-completion-status',
  );

  return (
    <EditableTableCard
      id={`edit-chapter13-standing-audit-${appointmentId}`}
      title="Audit"
      testId="chapter13-standing-audit-card"
      className="chapter13-standing-audit-card"
      tableId={`chapter13-standing-audit-table-${appointmentId}`}
      tableClassName="chapter13-standing-audit-table"
      tableAriaLabel="Audit key dates"
      tag={tag}
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit Audit key dates"
      editTitle="Edit Audit key dates"
      columns={[
        {
          key: 'annualAuditPeriod',
          header: 'Annual Audit Period',
          testId: 'annual-audit-period-row',
        },
        { key: 'lastAuditReport', header: 'Last Audit Report', testId: 'past-audit-row' },
      ]}
      values={{
        annualAuditPeriod: ANNUAL_AUDIT_PERIOD,
        lastAuditReport: formatDateOrDefault(data?.pastAudit),
      }}
    />
  );
}
