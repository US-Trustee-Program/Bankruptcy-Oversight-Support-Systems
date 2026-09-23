import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import {
  leaseExpirationField,
  idExpirationField,
  formatDateOrDefault,
} from './upcomingKeyDatesFieldConfig';

export interface Chapter12StandingOtherKeyDatesCardProps {
  trusteeId: string;
  appointmentId: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
}

export default function Chapter12StandingOtherKeyDatesCard(
  props: Readonly<Chapter12StandingOtherKeyDatesCardProps>,
) {
  const { trusteeId, appointmentId, data, isLoading } = props;
  const navigate = useNavigate();
  const canManage = useCanManageTrustees();

  function openEdit() {
    navigate(
      `/trustees/${trusteeId}/appointments/${appointmentId}/chapter12-standing-other-key-dates/edit`,
    );
  }

  if (isLoading) {
    return <LoadingSpinner id="chapter12-standing-other-key-dates-loading" />;
  }

  return (
    <EditableTableCard
      id={`edit-chapter12-standing-other-key-dates-${appointmentId}`}
      title="Other"
      testId="chapter12-standing-other-key-dates-card"
      className="chapter12-standing-other-key-dates-card"
      tableId={`chapter12-standing-other-key-dates-table-${appointmentId}`}
      tableClassName="chapter12-standing-other-key-dates-table"
      tableAriaLabel="Other key dates"
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit Other key dates"
      editTitle="Edit Other key dates"
      columns={[
        {
          key: 'annualReportDueToOO',
          header: 'Annual Report Due to OO',
          testId: 'annual-report-due-row',
        },
        { key: 'leaseExpiration', header: 'Lease Expiration', testId: 'lease-expiration-row' },
        {
          key: 'lastBackgroundQuestionnaire',
          header: 'Last Update to Background Questionnaire',
          testId: 'past-background-question-row',
        },
        { key: 'idExpiration', header: 'ID Expiration', testId: 'id-expiration-row' },
      ]}
      values={{
        annualReportDueToOO: '09/30 (Due non-audit years)',
        leaseExpiration: leaseExpirationField(data).value,
        lastBackgroundQuestionnaire: formatDateOrDefault(data?.pastBackgroundQuestion),
        idExpiration: idExpirationField(data).value,
      }}
    />
  );
}
