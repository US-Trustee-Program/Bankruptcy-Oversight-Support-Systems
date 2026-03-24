import './PastReportDates.scss';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrusteeUpcomingReportDates,
  isoToMMDDYYYY,
} from '@common/cams/trustee-upcoming-report-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';

export interface PastReportDatesProps {
  trusteeId: string;
  appointmentId: string;
  appointmentHeading?: string;
}

const NO_DATE = 'No date added';

export default function PastReportDates(props: Readonly<PastReportDatesProps>) {
  const { trusteeId, appointmentId, appointmentHeading } = props;
  const navigate = useNavigate();
  const session = LocalStorage.getSession();
  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<TrusteeUpcomingReportDates | null>(null);

  useEffect(() => {
    Api2.getUpcomingReportDates(trusteeId, appointmentId)
      .then((response) => {
        setData(response.data);
      })
      .catch((error) => {
        console.error('Could not load past report dates', error);
        setData(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId]);

  function openEdit() {
    navigate(`/trustees/${trusteeId}/appointments/${appointmentId}/past-report-dates/edit`, {
      state: { subHeading: appointmentHeading ?? '' },
    });
  }

  const fieldExam = data?.pastFieldExam ? isoToMMDDYYYY(data.pastFieldExam) : NO_DATE;
  const audit = data?.pastAudit ? isoToMMDDYYYY(data.pastAudit) : NO_DATE;

  if (isLoading) {
    return <LoadingSpinner id="past-report-dates-loading" />;
  }

  return (
    <div className="past-report-dates-card usa-card" data-testid="past-report-dates-card">
      <div className="usa-card__container">
        <div className="usa-card__body">
          <div className="past-report-dates-header">
            <h4>Past Report Dates</h4>
            {canManage && (
              <Button
                id="edit-past-report-dates"
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Edit past report dates"
                title="Edit past report dates"
                onClick={openEdit}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
            )}
          </div>
          <ul className="past-report-dates-list" data-testid="past-report-dates-list">
            <li data-testid="past-field-exam-row">
              <span className="past-report-dates-label">Field Exam:</span> {fieldExam}
            </li>
            <li data-testid="past-audit-row">
              <span className="past-report-dates-label">Audit:</span> {audit}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
