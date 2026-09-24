import { TrusteeUpcomingKeyDates, isoToMMDDYYYY } from '@common/cams/trustee-upcoming-key-dates';
import Chapter13StandingKeyDatesCard from './Chapter13StandingKeyDatesCard';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { useOpenEditKeyDates } from './useOpenEditKeyDates';
import CompletionStatusTag from './CompletionStatusTag';
import { NO_DATE } from './upcomingKeyDatesFieldConfig';

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

  const tag =
    data?.ch13AuditCompletionYear && data?.ch13AuditCompletionStatus ? (
      <CompletionStatusTag
        id="audit-completion-status"
        status={data.ch13AuditCompletionStatus}
        year={data.ch13AuditCompletionYear}
      />
    ) : undefined;

  return (
    <Chapter13StandingKeyDatesCard
      title="Audit"
      tag={tag}
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit Audit key dates"
      editTitle="Edit Audit key dates"
      testId="chapter13-standing-audit-card"
      fields={[
        {
          label: 'Annual Audit Period',
          value: ANNUAL_AUDIT_PERIOD,
          testId: 'annual-audit-period-row',
        },
        {
          label: 'Last Audit Report',
          value: data?.pastAudit ? isoToMMDDYYYY(data.pastAudit) : NO_DATE,
          testId: 'past-audit-row',
        },
      ]}
    />
  );
}
