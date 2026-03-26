import './PastKeyDates.scss';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrusteeUpcomingKeyDates, isoToMMDDYYYY } from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';

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

  const fieldExam = formatDateOrDefault(data?.pastFieldExam);
  const audit = formatDateOrDefault(data?.pastAudit);

  if (isLoading) {
    return <LoadingSpinner id="past-key-dates-loading" />;
  }

  return (
    <div className="past-key-dates-card usa-card" data-testid="past-key-dates-card">
      <div className="usa-card__container">
        <div className="usa-card__body">
          <div className="past-key-dates-header">
            <h4>Past Key Dates</h4>
            {canManage && (
              <Button
                id="edit-past-key-dates"
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Edit past key dates"
                title="Edit past key dates"
                onClick={openEdit}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
            )}
          </div>
          <ul className="past-key-dates-list" data-testid="past-key-dates-list">
            <li data-testid="past-field-exam-row">
              <span className="past-key-dates-label">Field Exam:</span> {fieldExam}
            </li>
            <li data-testid="past-audit-row">
              <span className="past-key-dates-label">Audit:</span> {audit}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
