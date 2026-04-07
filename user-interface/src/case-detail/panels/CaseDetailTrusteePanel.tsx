import './CaseDetailTrusteePanel.scss';
import { CaseDetail } from '@common/cams/cases';
import { useTrustee } from './useTrustee';
import CaseTrusteeCard from './cards/CaseTrusteeCard';
import ContactInformationCard from '@/trustees/panels/ContactInformationCard';
import MeetingOfCreditorsInfoCard from '@/trustees/panels/MeetingOfCreditorsInfoCard';

interface CaseDetailTrusteePanelProps {
  caseDetail: CaseDetail;
}

export default function CaseDetailTrusteePanel({
  caseDetail,
}: Readonly<CaseDetailTrusteePanelProps>) {
  const { trustee, loading } = useTrustee(caseDetail.trusteeId);

  if (!caseDetail.trusteeId) {
    return (
      <div data-testid="case-detail-trustee-panel" className={'case-detail-trustee-panel'}>
        <p data-testid="case-detail-trustee-panel-empty">
          No Trustee has been appointed for this case.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div data-testid="case-detail-trustee-panel" className={'case-detail-trustee-panel'}>
        <div data-testid="case-detail-trustee-panel-loading">Loading trustee information...</div>
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
      <div className="record-detail-card-list">
        <CaseTrusteeCard trustee={trustee} trusteeId={caseDetail.trusteeId} />
        <ContactInformationCard internalContact={trustee.internal} />
        <MeetingOfCreditorsInfoCard zoomInfo={trustee.zoomInfo} />
      </div>
    </div>
  );
}
