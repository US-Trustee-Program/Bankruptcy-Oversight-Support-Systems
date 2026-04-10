import './CaseDetailTrusteePanel.scss';
import { CaseDetail } from '@common/cams/cases';
import { useTrustee } from './useTrustee';
import { useCaseAppointment } from './useCaseAppointment';
import { TrusteeName } from './TrusteeName';
import FormattedContact from '@/lib/components/cams/FormattedContact';
import ContactInformationCard from '@/trustees/panels/ContactInformationCard';
import MeetingOfCreditorsInfoCard from '@/trustees/panels/MeetingOfCreditorsInfoCard';

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

interface CaseDetailTrusteePanelProps {
  caseDetail: CaseDetail;
}

export default function CaseDetailTrusteePanel({
  caseDetail,
}: Readonly<CaseDetailTrusteePanelProps>) {
  const {
    appointedDate,
    trusteeId,
    loading: appointmentLoading,
  } = useCaseAppointment(caseDetail.caseId);
  const { trustee, loading: trusteeLoading } = useTrustee(trusteeId ?? undefined);

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
              <div data-testid="case-trustee-card-name">
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
    </div>
  );
}
