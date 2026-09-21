import { useNavigate } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  isoToMMDDYYYY,
  isoToMMYYYY,
} from '@common/cams/trustee-upcoming-key-dates';
import Chapter13StandingKeyDatesCard from './Chapter13StandingKeyDatesCard';
import { useCanManageTrustees } from './useCanManageTrustees';
import { leaseExpirationField, idExpirationField } from './upcomingKeyDatesFieldConfig';

export interface Chapter13StandingOtherCardProps {
  trusteeId: string;
  appointmentId: string;
  appointmentHeading?: string;
  data: TrusteeUpcomingKeyDates | null;
}

const NO_DATE = 'No date added';

export default function Chapter13StandingOtherCard(
  props: Readonly<Chapter13StandingOtherCardProps>,
) {
  const { trusteeId, appointmentId, appointmentHeading, data } = props;
  const navigate = useNavigate();
  const canManage = useCanManageTrustees();

  function openEdit() {
    navigate(
      `/trustees/${trusteeId}/appointments/${appointmentId}/chapter13-standing-other-key-dates/edit`,
      { state: { subHeading: appointmentHeading ?? '' } },
    );
  }

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
