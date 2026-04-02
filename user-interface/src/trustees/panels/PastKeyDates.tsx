import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrusteeUpcomingKeyDates, isoToMMDDYYYY } from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import InfoCard from './InfoCard';

export interface PastKeyDatesProps {
  trusteeId: string;
  appointmentId: string;
  appointmentHeading?: string;
}

const NO_DATE = 'No date added';

export default function PastKeyDates(props: Readonly<PastKeyDatesProps>) {
  const { trusteeId, appointmentId, appointmentHeading } = props;
  const navigate = useNavigate();
  const session = LocalStorage.getSession();
  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<TrusteeUpcomingKeyDates | null>(null);

  useEffect(() => {
    Api2.getUpcomingKeyDates(trusteeId, appointmentId)
      .then((response) => {
        setData(response.data);
      })
      .catch((error) => {
        console.error('Could not load past key dates', error);
        setData(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId]);

  function openEdit() {
    navigate(`/trustees/${trusteeId}/appointments/${appointmentId}/past-key-dates/edit`, {
      state: { subHeading: appointmentHeading ?? '' },
    });
  }

  function formatDateOrDefault(isoDate: string | undefined): string {
    return isoDate ? isoToMMDDYYYY(isoDate) : NO_DATE;
  }

  const backgroundQuestion = formatDateOrDefault(data?.pastBackgroundQuestion);
  const fieldExam = formatDateOrDefault(data?.pastFieldExam);
  const audit = formatDateOrDefault(data?.pastAudit);
  const tprSubmission = formatDateOrDefault(data?.pastTprSubmission);

  if (isLoading) {
    return <LoadingSpinner id="past-key-dates-loading" />;
  }

  return (
    <InfoCard
      id="edit-past-key-dates"
      title="Past Key Dates"
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit past key dates"
      editTitle="Edit past key dates"
      testId="past-key-dates-card"
      listTestId="past-key-dates-list"
      fields={[
        {
          label: 'Background Question',
          value: backgroundQuestion,
          testId: 'past-background-question-row',
        },
        { label: 'Field Exam', value: fieldExam, testId: 'past-field-exam-row' },
        { label: 'Audit', value: audit, testId: 'past-audit-row' },
        { label: 'TPR Submission', value: tprSubmission, testId: 'past-tpr-submission-row' },
      ]}
    />
  );
}
