import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  isoToMMDD,
  isoRangeToMMDD,
  calculateAuditReqBy,
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

  const upcomingExamOrAuditLabel = data?.upcomingExamOrAuditType ?? 'Field Exam / Audit';
  const upcomingExamOrAuditValue = data?.upcomingExamOrAuditYear
    ? String(data.upcomingExamOrAuditYear)
    : NO_DATE;

  const auditReqByYear = calculateAuditReqBy(data?.lastAuditFiscalYear);
  const auditReqBy = auditReqByYear !== null ? String(auditReqByYear) : NO_DATE;

  const tprReviewPeriod =
    data?.tprReviewPeriodStart && data?.tprReviewPeriodEnd
      ? isoRangeToMMDD(data.tprReviewPeriodStart, data.tprReviewPeriodEnd)
      : NO_DATE;
  const tprDue =
    data?.tprDue && data?.tprDueYearType
      ? `${isoToMMDD(data.tprDue)} ${data.tprDueYearType}`
      : NO_DATE;

  let tirReviewPeriod = NO_DATE;
  if (data?.tirReviewPeriodStart && data?.tirReviewPeriodEnd) {
    const period1 = isoRangeToMMDD(data.tirReviewPeriodStart, data.tirReviewPeriodEnd);
    if (data.tirSemiAnnualReviewPeriodStart && data.tirSemiAnnualReviewPeriodEnd) {
      const period2 = isoRangeToMMDD(
        data.tirSemiAnnualReviewPeriodStart,
        data.tirSemiAnnualReviewPeriodEnd,
      );
      tirReviewPeriod = `${period1} & ${period2}`;
    } else {
      tirReviewPeriod = period1;
    }
  }

  let tirSubmission = NO_DATE;
  if (data?.tirSubmission) {
    if (data.tirSemiAnnualSubmission) {
      tirSubmission = `${isoToMMDD(data.tirSubmission)} & ${isoToMMDD(data.tirSemiAnnualSubmission)}`;
    } else {
      tirSubmission = isoToMMDD(data.tirSubmission);
    }
  }

  let tirReview = NO_DATE;
  if (data?.tirReview) {
    if (data.tirSemiAnnualReview) {
      tirReview = `${isoToMMDD(data.tirReview)} & ${isoToMMDD(data.tirSemiAnnualReview)}`;
    } else {
      tirReview = isoToMMDD(data.tirReview);
    }
  }

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
        {
          label: upcomingExamOrAuditLabel,
          value: upcomingExamOrAuditValue,
          testId: 'upcoming-exam-audit-row',
        },
        { label: 'Audit Required by', value: auditReqBy, testId: 'audit-req-by-row' },
        {
          label: 'Trustee Performance Review Period',
          value: tprReviewPeriod,
          testId: 'tpr-review-period-row',
        },
        {
          label: 'Trustee Performance Review Due',
          value: tprDue,
          testId: 'tpr-due-row',
        },
        { label: 'TIR Review Period', value: tirReviewPeriod, testId: 'tir-review-period-row' },
        { label: 'TIR Submission', value: tirSubmission, testId: 'tir-submission-row' },
        { label: 'TIR Due', value: tirReview, testId: 'tir-review-row' },
      ]}
    />
  );
}
