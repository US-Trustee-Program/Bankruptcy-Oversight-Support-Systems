import { useNavigate } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  isoToMMDDYYYY,
  isoToMMYYYY,
} from '@common/cams/trustee-upcoming-key-dates';
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
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
}

const NO_DATE = 'No date added';

function formatDateOrDefault(isoDate: string | undefined): string {
  return isoDate ? isoToMMDDYYYY(isoDate) : NO_DATE;
}

function formatMonthYearOrDefault(isoDate: string | undefined): string {
  return isoDate ? isoToMMYYYY(isoDate) : NO_DATE;
}

export default function PastKeyDates(props: Readonly<PastKeyDatesProps>) {
  const { variant, trusteeId, appointmentId, appointmentHeading, data, isLoading } = props;
  const navigate = useNavigate();
  const session = LocalStorage.getSession();
  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

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
        : field.kind === 'month-year'
          ? formatMonthYearOrDefault(data?.[field.key])
          : formatDateOrDefault(data?.[field.key]);
    return { label: field.displayLabel, value, testId: field.testId, stacked: field.stacked };
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
