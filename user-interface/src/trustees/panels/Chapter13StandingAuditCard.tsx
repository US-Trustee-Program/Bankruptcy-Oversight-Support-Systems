import { useNavigate } from 'react-router-dom';
import { TrusteeUpcomingKeyDates, isoToMMDDYYYY } from '@common/cams/trustee-upcoming-key-dates';
import Chapter13StandingKeyDatesCard from './Chapter13StandingKeyDatesCard';
import { useCanManageTrustees } from './useCanManageTrustees';
import CompletionStatusTag from './CompletionStatusTag';

export interface Chapter13StandingAuditCardProps {
  trusteeId: string;
  appointmentId: string;
  appointmentHeading?: string;
  data: TrusteeUpcomingKeyDates | null;
}

const NO_DATE = 'No date added';
const ANNUAL_AUDIT_PERIOD = '10/01 - 09/30';

export default function Chapter13StandingAuditCard(
  props: Readonly<Chapter13StandingAuditCardProps>,
) {
  const { trusteeId, appointmentId, appointmentHeading, data } = props;
  const navigate = useNavigate();
  const canManage = useCanManageTrustees();

  function openEdit() {
    navigate(
      `/trustees/${trusteeId}/appointments/${appointmentId}/chapter13-standing-audit-key-dates/edit`,
      { state: { subHeading: appointmentHeading ?? '' } },
    );
  }

  const tag =
    data?.auditCompletionYear && data?.auditCompletionStatus ? (
      <CompletionStatusTag
        id="audit-completion-status"
        status={data.auditCompletionStatus}
        year={data.auditCompletionYear}
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
