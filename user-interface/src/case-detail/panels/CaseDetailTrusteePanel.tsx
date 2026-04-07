import { CaseDetail } from '@common/cams/cases';
import CaseTrusteeCard from './cards/CaseTrusteeCard';

interface CaseDetailTrusteePanelProps {
  caseDetail: CaseDetail;
}

export default function CaseDetailTrusteePanel({
  caseDetail,
}: Readonly<CaseDetailTrusteePanelProps>) {
  if (!caseDetail.trusteeId) {
    return (
      <div
        data-testid="case-detail-trustee-panel"
        className="grid-col-12 tablet:grid-col-10 desktop:grid-col-8 record-detail-container"
      >
        <p data-testid="case-detail-trustee-panel-empty">
          No Trustee has been appointed for this case.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="case-detail-trustee-panel"
      className="grid-col-12 tablet:grid-col-10 desktop:grid-col-8 record-detail-container"
    >
      <CaseTrusteeCard trusteeId={caseDetail.trusteeId} />
    </div>
  );
}
