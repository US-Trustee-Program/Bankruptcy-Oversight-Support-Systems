// TODO: This component shares significant structure with UpcomingKeyDates.tsx.
// Once upcoming key dates are implemented for additional chapter types, revisit
// whether a shared hook or config-driven pattern makes sense across all variants.
import { useNavigate } from 'react-router-dom';
import {
  TrusteeUpcomingKeyDates,
  isoToMMDD,
  isoRangeToMMDD,
  isoToMMDDYYYY,
  calculateAuditReqBy,
} from '@common/cams/trustee-upcoming-key-dates';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import InfoCard from './InfoCard';

export interface Chapter12StandingUpcomingKeyDatesProps {
  trusteeId: string;
  appointmentId: string;
  appointmentHeading?: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
}

const NO_DATE = 'No date added';

export default function Chapter12StandingUpcomingKeyDates(
  props: Readonly<Chapter12StandingUpcomingKeyDatesProps>,
) {
  const { trusteeId, appointmentId, appointmentHeading, data, isLoading } = props;
  const navigate = useNavigate();
  const session = LocalStorage.getSession();
  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  function openEdit() {
    navigate(`/trustees/${trusteeId}/appointments/${appointmentId}/upcoming-key-dates/edit`, {
      state: { subHeading: appointmentHeading ?? '', variant: 'chapter12-standing' },
    });
  }

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

  const leaseExpiration = data?.leaseExpiration ? isoToMMDDYYYY(data.leaseExpiration) : NO_DATE;
  const idExpiration = data?.idExpiration ? isoToMMDDYYYY(data.idExpiration) : NO_DATE;

  if (isLoading) {
    return <LoadingSpinner id="ch12-upcoming-key-dates-loading" />;
  }

  return (
    <InfoCard
      id="edit-ch12-upcoming-key-dates"
      title="Upcoming Key Dates"
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit upcoming key dates"
      editTitle="Edit upcoming key dates"
      testId="ch12-upcoming-key-dates-card"
      listTestId="ch12-upcoming-key-dates-list"
      fields={[
        { label: 'Audit Req. By', value: auditReqBy, testId: 'audit-req-by-row' },
        {
          label: 'Annual Report Due to OO',
          value: '09/30 (Due non-audit years)',
          testId: 'annual-report-due-row',
        },
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
        { label: 'Lease Expiration', value: leaseExpiration, testId: 'lease-expiration-row' },
        {
          label: 'Budget Submission Due',
          value: '05/01',
          testId: 'budget-submission-due-row',
        },
        { label: 'Budget Review to OO', value: '06/01', testId: 'budget-review-to-oo-row' },
        { label: 'ID Expiration', value: idExpiration, testId: 'id-expiration-row' },
      ]}
    />
  );
}
