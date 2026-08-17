import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrusteeUpcomingKeyDates, isoToMMDDYYYY } from '@common/cams/trustee-upcoming-key-dates';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import InfoCard from './InfoCard';
import { PAST_KEY_DATES_FIELD_CONFIG, PastKeyDatesVariant } from './pastKeyDatesFieldConfig';

export interface PastKeyDatesProps {
  variant: PastKeyDatesVariant;
  trusteeId: string;
  appointmentId: string;
  appointmentHeading?: string;
}

const NO_DATE = 'No date added';

function formatDateOrDefault(isoDate: string | undefined): string {
  return isoDate ? isoToMMDDYYYY(isoDate) : NO_DATE;
}

export default function PastKeyDates(props: Readonly<PastKeyDatesProps>) {
  const { variant, trusteeId, appointmentId, appointmentHeading } = props;
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
      state: { subHeading: appointmentHeading ?? '', variant },
    });
  }

  if (isLoading) {
    return <LoadingSpinner id="past-key-dates-loading" />;
  }

  const fields = PAST_KEY_DATES_FIELD_CONFIG[variant].map((field) => {
    const value =
      field.kind === 'year'
        ? (data?.lastAuditFiscalYear?.toString() ?? NO_DATE)
        : formatDateOrDefault(data?.[field.key as keyof TrusteeUpcomingKeyDates] as string);
    return { label: field.displayLabel, value, testId: field.testId };
  });

  return (
    <InfoCard
      id="edit-past-key-dates"
      title="Past Key Dates"
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit past key dates"
      editTitle="Edit past key dates"
      testId="past-key-dates-card"
      listTestId="past-key-dates-list"
      fields={fields}
    />
  );
}
