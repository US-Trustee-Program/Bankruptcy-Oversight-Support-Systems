import { useNavigate } from 'react-router-dom';
import { TrusteeUpcomingKeyDates, isoToMMDDYYYY } from '@common/cams/trustee-upcoming-key-dates';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import Chapter13StandingKeyDatesCard from './Chapter13StandingKeyDatesCard';
import Tag, { UswdsTagStyle } from '@/lib/components/uswds/Tag';

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
  const session = LocalStorage.getSession();
  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  function openEdit() {
    navigate(
      `/trustees/${trusteeId}/appointments/${appointmentId}/chapter13-standing-audit-key-dates/edit`,
      { state: { subHeading: appointmentHeading ?? '' } },
    );
  }

  const tag =
    data?.auditCompletionYear && data?.auditCompletionStatus ? (
      data.auditCompletionStatus === 'Complete' ? (
        <Tag id="audit-completion-status" uswdsStyle={UswdsTagStyle.Green}>
          Complete for {data.auditCompletionYear}
        </Tag>
      ) : (
        <Tag id="audit-completion-status" style={{ backgroundColor: '#B50909', color: 'white' }}>
          Incomplete for {data.auditCompletionYear}
        </Tag>
      )
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
