import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { useOpenEditKeyDates } from './useOpenEditKeyDates';
import {
  examOrAuditField,
  auditReqByField,
  formatDateOrDefault,
  NO_DATE,
  buildCompletionTag,
} from './upcomingKeyDatesFieldConfig';

export interface Chapter7PanelAuditFieldExamCardProps {
  trusteeId: string;
  appointmentId: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
}

function formatYearOrDefault(year: number | undefined): string {
  return year !== undefined ? year.toString() : NO_DATE;
}

export default function Chapter7PanelAuditFieldExamCard(
  props: Readonly<Chapter7PanelAuditFieldExamCardProps>,
) {
  const { trusteeId, appointmentId, data, isLoading } = props;
  const canManage = useCanManageTrustees();
  const openEdit = useOpenEditKeyDates(trusteeId, appointmentId, 'audit-field-exam-key-dates');

  if (isLoading) {
    return <LoadingSpinner id="chapter7-panel-audit-field-exam-loading" />;
  }

  const examOrAudit = examOrAuditField(data);
  const auditReqBy = auditReqByField(data);

  const tag = buildCompletionTag(
    data?.auditCompletionYear,
    data?.auditCompletionStatus,
    'CLOSED',
    `audit-completion-status-tag-${appointmentId}`,
  );

  return (
    <EditableTableCard
      id={`edit-chapter7-panel-audit-field-exam-${appointmentId}`}
      title="Audit/Field Exam"
      testId="chapter7-panel-audit-field-exam-card"
      className="chapter7-panel-audit-field-exam-card"
      tableId={`chapter7-panel-audit-field-exam-table-${appointmentId}`}
      tableClassName="chapter7-panel-audit-field-exam-table"
      tableAriaLabel="Audit/Field Exam key dates"
      tag={tag}
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit Audit/Field Exam key dates"
      editTitle="Edit Audit/Field Exam key dates"
      columns={[
        { key: 'examOrAudit', header: 'Audit', testId: 'upcoming-exam-audit-row' },
        { key: 'auditReqBy', header: 'Audit Req by', testId: 'audit-req-by-row' },
        {
          key: 'lastAuditFiscalYear',
          header: "Last Audit's Fiscal Year",
          testId: 'past-last-audit-fiscal-year-row',
        },
        { key: 'lastAuditReport', header: 'Last Audit Report', testId: 'past-audit-row' },
        {
          key: 'lastFieldExamReport',
          header: 'Last Field Exam Report',
          testId: 'past-field-exam-row',
        },
      ]}
      values={{
        examOrAudit: examOrAudit.value,
        auditReqBy: auditReqBy.value,
        lastAuditFiscalYear: formatYearOrDefault(data?.lastAuditFiscalYear),
        lastAuditReport: formatDateOrDefault(data?.pastAudit),
        lastFieldExamReport: formatDateOrDefault(data?.pastFieldExam),
      }}
    />
  );
}
