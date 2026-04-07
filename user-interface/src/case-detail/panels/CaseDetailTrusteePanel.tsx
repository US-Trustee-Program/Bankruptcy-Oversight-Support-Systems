import { CaseDetail } from '@common/cams/cases';
import { useTrustee } from './useTrustee';
import CaseTrusteeCard from './cards/CaseTrusteeCard';
import CaseTrusteeInternalCard from './cards/CaseTrusteeInternalCard';

interface CaseDetailTrusteePanelProps {
  caseDetail: CaseDetail;
}

const PANEL_CLASS = 'grid-col-12 tablet:grid-col-10 desktop:grid-col-8 record-detail-container';

export default function CaseDetailTrusteePanel({
  caseDetail,
}: Readonly<CaseDetailTrusteePanelProps>) {
  const { trustee, loading } = useTrustee(caseDetail.trusteeId);

  if (!caseDetail.trusteeId) {
    return (
      <div data-testid="case-detail-trustee-panel" className={PANEL_CLASS}>
        <p data-testid="case-detail-trustee-panel-empty">
          No Trustee has been appointed for this case.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div data-testid="case-detail-trustee-panel" className={PANEL_CLASS}>
        <div data-testid="case-detail-trustee-panel-loading">Loading trustee information...</div>
      </div>
    );
  }

  if (!trustee) {
    return (
      <div data-testid="case-detail-trustee-panel" className={PANEL_CLASS}>
        <p data-testid="case-detail-trustee-panel-no-info">No trustee information available.</p>
      </div>
    );
  }

  return (
    <div data-testid="case-detail-trustee-panel" className={PANEL_CLASS}>
      <div className="record-detail-card-list">
        <CaseTrusteeCard trustee={trustee} trusteeId={caseDetail.trusteeId} />
        <CaseTrusteeInternalCard internalContact={trustee.internal} />
      </div>
    </div>
  );
}
