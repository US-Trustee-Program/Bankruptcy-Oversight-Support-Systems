import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import InfoCard from './InfoCard';
import {
  UPCOMING_KEY_DATES_FIELD_CONFIG,
  UpcomingKeyDatesVariant,
} from './upcomingKeyDatesFieldConfig';

export interface UpcomingKeyDatesProps {
  variant?: UpcomingKeyDatesVariant;
  trusteeId: string;
  appointmentId: string;
  appointmentHeading?: string;
}

export default function UpcomingKeyDates(props: Readonly<UpcomingKeyDatesProps>) {
  const { variant = 'chapter7-panel', trusteeId, appointmentId, appointmentHeading } = props;
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

  if (isLoading) {
    return <LoadingSpinner id="upcoming-key-dates-loading" />;
  }

  const fields = UPCOMING_KEY_DATES_FIELD_CONFIG[variant].map((field) =>
    field.kind === 'constant'
      ? { label: field.displayLabel, value: field.value, testId: field.testId }
      : field.buildField(data),
  );

  return (
    <InfoCard
      id="edit-upcoming-key-dates"
      title="Upcoming Key Dates"
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit upcoming key dates"
      editTitle="Edit upcoming key dates"
      testId="upcoming-key-dates-card"
      listTestId="upcoming-key-dates-list"
      fields={fields}
    />
  );
}
