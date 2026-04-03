import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  isoToMMDDYYYY,
  isoToMMDD,
  isoRangeToMMDD,
} from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import InfoCard from './InfoCard';

export interface UpcomingKeyDatesProps {
  trusteeId: string;
  appointmentId: string;
  appointmentHeading?: string;
}

const NO_DATE = 'No date added';

export default function UpcomingKeyDates(props: Readonly<UpcomingKeyDatesProps>) {
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
        console.error('Could not load upcoming key dates', error);
        setData(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId]);

  function openEdit() {
    navigate(`/trustees/${trusteeId}/appointments/${appointmentId}/upcoming-key-dates/edit`, {
      state: { subHeading: appointmentHeading ?? '' },
    });
  }

  const fieldExam = data?.upcomingFieldExam ? isoToMMDDYYYY(data.upcomingFieldExam) : NO_DATE;
  const audit = data?.upcomingIndependentAuditRequired
    ? isoToMMDDYYYY(data.upcomingIndependentAuditRequired)
    : NO_DATE;
  const tprReviewPeriod =
    data?.tprReviewPeriodStart && data?.tprReviewPeriodEnd
      ? isoRangeToMMDD(data.tprReviewPeriodStart, data.tprReviewPeriodEnd)
      : NO_DATE;
  const tprDue =
    data?.tprDue && data?.tprDueYearType
      ? `${isoToMMDD(data.tprDue)} ${data.tprDueYearType}`
      : NO_DATE;
  const tirReviewPeriod =
    data?.tirReviewPeriodStart && data?.tirReviewPeriodEnd
      ? isoRangeToMMDD(data.tirReviewPeriodStart, data.tirReviewPeriodEnd)
      : NO_DATE;
  const tirSubmission = data?.tirSubmission ? isoToMMDD(data.tirSubmission) : NO_DATE;
  const tirReview = data?.tirReview ? isoToMMDD(data.tirReview) : NO_DATE;

  if (isLoading) {
    return <LoadingSpinner id="upcoming-key-dates-loading" />;
  }

  return (
    <InfoCard
      id="edit-upcoming-key-dates"
      title="Upcoming Key Dates"
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit upcoming key dates"
      editTitle="Edit upcoming key dates"
      testId="upcoming-key-dates-card"
      listTestId="upcoming-key-dates-list"
      fields={[
        { label: 'Field Exam', value: fieldExam, testId: 'field-exam-row' },
        { label: 'Audit', value: audit, testId: 'audit-row' },
        { label: 'TPR Review Period', value: tprReviewPeriod, testId: 'tpr-review-period-row' },
        { label: 'TPR Due', value: tprDue, testId: 'tpr-due-row' },
        { label: 'TIR Review Period', value: tirReviewPeriod, testId: 'tir-review-period-row' },
        { label: 'TIR Submission', value: tirSubmission, testId: 'tir-submission-row' },
        { label: 'TIR Review', value: tirReview, testId: 'tir-review-row' },
      ]}
    />
  );
}
