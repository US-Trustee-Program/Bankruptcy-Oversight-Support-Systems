import './CaseDetailTrusteePanel.scss';
import { useEffect } from 'react';
import { CaseDetail } from '@common/cams/cases';
import { CaseTrusteeAppointmentHistoryItem } from '@common/cams/trustee-appointments';
import { useTrustee } from './useTrustee';
import { useCaseAppointment } from './useCaseAppointment';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';
import { TrusteeName } from './TrusteeName';
import FormattedContact from '@/lib/components/cams/FormattedContact';
import ContactInformationCard from '@/trustees/panels/ContactInformationCard';
import MeetingOfCreditorsInfoCard from '@/trustees/panels/MeetingOfCreditorsInfoCard';
import useFeatureFlags, { TRUSTEE_APPOINTMENT_HISTORY_ENABLED } from '@/lib/hooks/UseFeatureFlags';

const appointedDateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'UTC',
});

function formatAppointedDate(isoDate: string): string | null {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (isNaN(date.getTime())) return null;
  return appointedDateFormatter.format(date);
}

interface PastTrusteesSectionProps {
  history: CaseTrusteeAppointmentHistoryItem[];
}

function PastTrusteesSection({ history }: Readonly<PastTrusteesSectionProps>) {
  if (history.length === 0) {
    return (
      <div data-testid="past-trustees-empty" className="past-trustees-empty">
        No past trustees for this case.
      </div>
    );
  }

  return (
    <div data-testid="past-trustees-section" className="past-trustees-section">
      <h3>Past Trustees</h3>
      <table className="usa-table usa-table--borderless" style={{ width: 'auto' }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Appointment Started</th>
            <th>Appointment Ended</th>
          </tr>
        </thead>
        <tbody>
          {history.map((item) => (
            <tr key={item.id}>
              <td>
                {item.trusteeName ? (
                  <a
                    href={`/trustees/${item.trusteeId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="usa-link usa-link--external"
                  >
                    {item.trusteeName}
                  </a>
                ) : (
                  item.trusteeId
                )}
              </td>
              <td>{item.appointedDate ? formatAppointedDate(item.appointedDate) : ''}</td>
              <td>
                {item.unassignedOn ? formatAppointedDate(item.unassignedOn.split('T')[0]) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
        <div data-testid="case-trustee-card" className="case-trustee-information usa-card">
          <div className="usa-card__container">
            <div className="usa-card__body">
              <h4>Public Contact Info</h4>
              <div data-testid="case-trustee-card-name" className="case-trustee-card-name">
                <TrusteeName trusteeName={trustee.name} trusteeId={trusteeId} openNewTab />
              </div>
              <div data-testid="case-trustee-public-contact">
                <FormattedContact contact={trustee.public} testIdPrefix="case-trustee-public" />
              </div>
            </div>
          </div>
        </div>
        <ContactInformationCard internalContact={trustee.internal} />
        <MeetingOfCreditorsInfoCard zoomInfo={trustee.zoomInfo} />
      </div>
      {historyEnabled && <PastTrusteesSection history={history} />}
    </div>
  );
}
