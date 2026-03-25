import './UpcomingKeyDates.scss';
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
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';

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
    <div className="upcoming-key-dates-card usa-card" data-testid="upcoming-key-dates-card">
      <div className="usa-card__container">
        <div className="usa-card__body">
          <div className="upcoming-key-dates-header">
            <h4>Upcoming Key Dates</h4>
            {canManage && (
              <Button
                id="edit-upcoming-key-dates"
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Edit upcoming key dates"
                title="Edit upcoming key dates"
                onClick={openEdit}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
            )}
          </div>
          <ul className="upcoming-key-dates-list" data-testid="upcoming-key-dates-list">
            <li data-testid="field-exam-row">
              <span className="upcoming-key-dates-label">Field Exam:</span> {fieldExam}
            </li>
            <li data-testid="audit-row">
              <span className="upcoming-key-dates-label">Audit:</span> {audit}
            </li>
            <li data-testid="tpr-review-period-row">
              <span className="upcoming-key-dates-label">TPR Review Period:</span> {tprReviewPeriod}
            </li>
            <li data-testid="tpr-due-row">
              <span className="upcoming-key-dates-label">TPR Due:</span> {tprDue}
            </li>
            <li data-testid="tir-review-period-row">
              <span className="upcoming-key-dates-label">TIR Review Period:</span> {tirReviewPeriod}
            </li>
            <li data-testid="tir-submission-row">
              <span className="upcoming-key-dates-label">TIR Submission:</span> {tirSubmission}
            </li>
            <li data-testid="tir-review-row">
              <span className="upcoming-key-dates-label">TIR Review:</span> {tirReview}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
