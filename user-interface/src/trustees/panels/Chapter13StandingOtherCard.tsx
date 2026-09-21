import {
  TrusteeUpcomingKeyDates,
  isoToMMDDYYYY,
  isoToMMYYYY,
} from '@common/cams/trustee-upcoming-key-dates';
import Chapter13StandingKeyDatesCard from './Chapter13StandingKeyDatesCard';
import { useCanManageTrustees } from './useCanManageTrustees';
import { useOpenEditKeyDates } from './useOpenEditKeyDates';
import { leaseExpirationField, idExpirationField, NO_DATE } from './upcomingKeyDatesFieldConfig';

export interface Chapter13StandingOtherCardProps {
  trusteeId: string;
  appointmentId: string;
  appointmentHeading?: string;
  data: TrusteeUpcomingKeyDates | null;
}

export default function Chapter13StandingOtherCard(
  props: Readonly<Chapter13StandingOtherCardProps>,
) {
  const { trusteeId, appointmentId, appointmentHeading, data } = props;
  const canManage = useCanManageTrustees();
  const openEdit = useOpenEditKeyDates(
    trusteeId,
    appointmentId,
    'chapter13-standing-other-key-dates',
    appointmentHeading,
  );

  const lease = leaseExpirationField(data);
  const idExp = idExpirationField(data);

  return (
    <Chapter13StandingKeyDatesCard
      title="Other"
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit Other key dates"
      editTitle="Edit Other key dates"
      testId="chapter13-standing-other-card"
      fields={[
        { label: lease.label, value: lease.value, testId: lease.testId },
        {
          label: 'Last Update to Background Questionnaire',
          value: data?.pastBackgroundQuestion
            ? isoToMMDDYYYY(data.pastBackgroundQuestion)
            : NO_DATE,
          testId: 'past-background-question-row',
        },
        { label: idExp.label, value: idExp.value, testId: idExp.testId },
        {
          label: 'Last Compensation Study',
          value: data?.lastCompensationStudy ? isoToMMYYYY(data.lastCompensationStudy) : NO_DATE,
          testId: 'last-compensation-study-row',
        },
      ]}
    />
  );
}
