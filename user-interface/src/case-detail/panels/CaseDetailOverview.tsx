import './CaseDetailOverview.scss';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { CaseDetail } from '@common/cams/cases';
import DatesCard from './cards/DatesCard';
import DebtorCard from './cards/DebtorCard';
import { composeCaseTitle } from '../caseDetailHelper';

export interface CaseDetailOverviewProps {
  caseDetail: CaseDetail;
  showReopenDate: boolean;
}

function CaseDetailOverview(props: Readonly<CaseDetailOverviewProps>) {
  const { caseDetail, showReopenDate } = props;

  return (
    <div className="grid-col-12 tablet:grid-col-10 desktop:grid-col-8 record-detail-container">
      <div className="record-detail-card-list">
        <DatesCard
          dateFiled={caseDetail.dateFiled}
          reopenedDate={caseDetail.reopenedDate}
          closedDate={caseDetail.closedDate}
          dismissedDate={caseDetail.dismissedDate}
          showReopenDate={showReopenDate}
        />
      </div>
      <DebtorCard
        title={`Debtor - ${caseDetail.debtor.name}`}
        debtor={caseDetail.debtor}
        debtorTypeLabel={caseDetail.debtorTypeLabel}
        attorney={caseDetail.debtorAttorney}
        caseId={getCaseNumber(caseDetail.caseId)}
        caseTitle={composeCaseTitle(caseDetail)}
        testIdPrefix="case-detail-debtor"
      />
      {caseDetail.jointDebtor && (
        <DebtorCard
          title={`Joint Debtor - ${caseDetail.jointDebtor.name}`}
          debtor={caseDetail.jointDebtor}
          attorney={caseDetail.jointDebtorAttorney}
          caseId={getCaseNumber(caseDetail.caseId)}
          caseTitle={composeCaseTitle(caseDetail)}
          testIdPrefix="case-detail-joint-debtor"
        />
      )}
    </div>
  );
}

export default CaseDetailOverview;
