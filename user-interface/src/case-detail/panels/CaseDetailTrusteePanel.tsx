import './CaseDetailTrusteePanel.scss';
import { useEffect } from 'react';
import { CaseDetail } from '@common/cams/cases';
import { CaseTrusteeAppointmentHistoryItem } from '@common/cams/trustee-appointments';
import { useTrustee } from './useTrustee';
import { useCaseAppointment } from './useCaseAppointment';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';
import ContactInformationCard from '@/trustees/panels/ContactInformationCard';
import MeetingOfCreditorsInfoCard from '@/trustees/panels/MeetingOfCreditorsInfoCard';
import useFeatureFlags, { TRUSTEE_APPOINTMENT_HISTORY_ENABLED } from '@/lib/hooks/UseFeatureFlags';
import TrusteeOverviewCard from '@/trustees/panels/TrusteeOverviewCard';
import { TrusteeName } from './TrusteeName';
import { CamsTable } from '@/lib/components/cams/CamsTable/CamsTable';
import { CamsTableHeader } from '@/lib/components/cams/CamsTable/CamsTableHeader';
import { CamsTableHeaderCell } from '@/lib/components/cams/CamsTable/CamsTableHeaderCell';
import { CamsTableBody } from '@/lib/components/cams/CamsTable/CamsTableBody';
import { CamsTableRow } from '@/lib/components/cams/CamsTable/CamsTableRow';
import { CamsTableCell } from '@/lib/components/cams/CamsTable/CamsTableCell';

const appointedDateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'UTC',
});

function formatAppointedDate(isoDateTime: string): string | null {
  const [datePart] = isoDateTime.split('T');
  const date = new Date(`${datePart}T00:00:00Z`);
  if (isNaN(date.getTime())) return null;
  return appointedDateFormatter.format(date);
}

interface PastTrusteesSectionProps {
  history: CaseTrusteeAppointmentHistoryItem[];
}

function PastTrusteesSection({ history }: Readonly<PastTrusteesSectionProps>) {
  if (history.length === 0) {
    return null;
  }

  return (
    <div data-testid="past-trustees-section" className="past-trustees-section">
      <h3 className="table-header">Past Trustees</h3>
      <CamsTable
        data-testid="past-trustees-table"
        caption="Past Trustees"
        aria-label="Past Trustees"
      >
        <CamsTableHeader>
          <CamsTableHeaderCell className="name-header">Name</CamsTableHeaderCell>
          <CamsTableHeaderCell>Appointment Started</CamsTableHeaderCell>
          <CamsTableHeaderCell>Appointment Ended</CamsTableHeaderCell>
        </CamsTableHeader>
        <CamsTableBody>
          {history.map((item) => (
            <CamsTableRow key={item.id}>
              <CamsTableCell data-cell="Name">
                <span className="name-cell-container nowrap">
                  {item.trusteeName ? (
                    <TrusteeName
                      trusteeName={item.trusteeName}
                      trusteeId={item.trusteeId}
                      openNewTab
                      source="case-detail-past"
                    />
                  ) : (
                    item.trusteeId
                  )}
                </span>
              </CamsTableCell>
              <CamsTableCell data-cell="Appointment Started">
                {item.appointedDate ? formatAppointedDate(item.appointedDate) : ''}
              </CamsTableCell>
              <CamsTableCell data-cell="Appointment Ended">
                {item.unassignedOn ? formatAppointedDate(item.unassignedOn) : ''}
              </CamsTableCell>
            </CamsTableRow>
          ))}
        </CamsTableBody>
      </CamsTable>
    </div>
  );
}

interface CaseDetailTrusteePanelProps {
  caseDetail: CaseDetail;
}

export default function CaseDetailTrusteePanel({
  caseDetail,
}: Readonly<CaseDetailTrusteePanelProps>) {
  const featureFlags = useFeatureFlags();
  const historyEnabled = featureFlags[TRUSTEE_APPOINTMENT_HISTORY_ENABLED];
  const {
    appointedDate,
    trusteeId,
    history,
    loading: appointmentLoading,
  } = useCaseAppointment(caseDetail.caseId);
  const { trustee, loading: trusteeLoading } = useTrustee(trusteeId ?? undefined);

  useEffect(() => {
    if (trustee) {
      getAppInsights().appInsights.trackEvent({ name: 'Trustee Info Viewed' });
    }
  }, [trustee]);

  if (appointmentLoading || trusteeLoading) {
    return (
      <div data-testid="case-detail-trustee-panel" className={'case-detail-trustee-panel'}>
        <div data-testid="case-detail-trustee-panel-loading">Loading trustee information...</div>
      </div>
    );
  }

  if (!trusteeId) {
    return (
      <div data-testid="case-detail-trustee-panel" className={'case-detail-trustee-panel'}>
        <p data-testid="case-detail-trustee-panel-empty">
          No Trustee has been appointed for this case.
        </p>
      </div>
    );
  }

  if (!trustee) {
    return (
      <div data-testid="case-detail-trustee-panel" className={'case-detail-trustee-panel'}>
        <p data-testid="case-detail-trustee-panel-no-info">No trustee information available.</p>
      </div>
    );
  }

  return (
    <div data-testid="case-detail-trustee-panel" className={'case-detail-trustee-panel'}>
      <h3 data-testid="case-detail-trustee-panel-heading">Trustee - {trustee.name}</h3>
      {appointedDate && formatAppointedDate(appointedDate) && (
        <p data-testid="case-detail-trustee-panel-appointed-date" className="appointed-date">
          <strong>Appointed:</strong> {formatAppointedDate(appointedDate)}
        </p>
      )}
      <div className="record-detail-card-list">
        <TrusteeOverviewCard
          trustee={trustee}
          trusteeId={trusteeId}
          headerText="Public Contact Info"
          testIdPrefix="case-trustee-public"
        />
        <ContactInformationCard internalContact={trustee.internal} />
        <MeetingOfCreditorsInfoCard zoomInfo={trustee.zoomInfo} />
      </div>
      {historyEnabled && trusteeId && <PastTrusteesSection history={history} />}
    </div>
  );
}
