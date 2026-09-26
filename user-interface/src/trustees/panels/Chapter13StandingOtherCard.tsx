import {
  TrusteeUpcomingKeyDates,
  isoToMMDDYYYY,
  isoToMMYYYY,
} from '@common/cams/trustee-upcoming-key-dates';
import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import useCanManageTrustees from '@/lib/hooks/UseCanManageTrustees';
import { useOpenEditKeyDates } from './useOpenEditKeyDates';
import { leaseExpirationField, idExpirationField, NO_DATE } from './upcomingKeyDatesFieldConfig';

export interface Chapter13StandingOtherCardProps {
  trusteeId: string;
  appointmentId: string;
  data: TrusteeUpcomingKeyDates | null;
}

export default function Chapter13StandingOtherCard(
  props: Readonly<Chapter13StandingOtherCardProps>,
) {
  const { trusteeId, appointmentId, data } = props;
  const canManage = useCanManageTrustees();
  const openEdit = useOpenEditKeyDates(
    trusteeId,
    appointmentId,
    'chapter13-standing-other-key-dates',
  );

  return (
    <EditableTableCard
      id={`edit-chapter13-standing-other-key-dates-${appointmentId}`}
      title="Other"
      testId="chapter13-standing-other-card"
      className="chapter13-standing-other-card"
      tableId={`chapter13-standing-other-table-${appointmentId}`}
      tableClassName="chapter13-standing-other-table"
      tableAriaLabel="Other key dates"
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit Other key dates"
      editTitle="Edit Other key dates"
      columns={[
        { key: 'leaseExpiration', header: 'Lease Expiration', testId: 'lease-expiration-row' },
        {
          key: 'lastBackgroundQuestionnaire',
          header: 'Last Update to Background Questionnaire',
          testId: 'past-background-question-row',
        },
        { key: 'idExpiration', header: 'ID Expiration', testId: 'id-expiration-row' },
        {
          key: 'lastCompensationStudy',
          header: 'Last Compensation Study',
          testId: 'last-compensation-study-row',
        },
      ]}
      values={{
        leaseExpiration: leaseExpirationField(data).value,
        lastBackgroundQuestionnaire: data?.pastBackgroundQuestion
          ? isoToMMDDYYYY(data.pastBackgroundQuestion)
          : NO_DATE,
        idExpiration: idExpirationField(data).value,
        lastCompensationStudy: data?.lastCompensationStudy
          ? isoToMMYYYY(data.lastCompensationStudy)
          : NO_DATE,
      }}
    />
  );
}
