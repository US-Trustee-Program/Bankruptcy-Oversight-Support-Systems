import { Consolidation, EventCaseReference, Transfer } from '@common/cams/events';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate, sortByDateReverse } from '@/lib/utils/datetime';
import { consolidationTypeMap } from '@/lib/utils/labels';
import './CaseDetailAssociatedCases.scss';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import {
  CaseDetail,
  getCaseConsolidationType,
  getLeadCaseLabel,
  getMemberCaseLabel,
} from '@common/cams/cases';
import { LeadCaseIcon, MemberCaseIcon } from '@/lib/components/cams/RawSvgIcon';

interface CaseDetailAssociatedCasesProps {
  caseDetail: CaseDetail;
  associatedCases: EventCaseReference[];
  isAssociatedCasesLoading: boolean;
}

export default function CaseDetailAssociatedCases(props: CaseDetailAssociatedCasesProps) {
  const { caseDetail, associatedCases, isAssociatedCasesLoading } = props;
  const consolidation = associatedCases.filter(
    (c) => c.documentType === 'CONSOLIDATION_FROM' || c.documentType === 'CONSOLIDATION_TO',
  ) as Consolidation[];
  const consolidationType = getCaseConsolidationType(consolidation, consolidationTypeMap);

  function sortTransfers(a: Transfer, b: Transfer) {
    return sortByDateReverse(a.orderDate, b.orderDate);
  }

  const isAmbiguousTransferIn =
    !!caseDetail.petitionCode && ['TI', 'TV'].includes(caseDetail.petitionCode);
  const isAmbiguousTransferOut = !!caseDetail.transferDate;
  const isAmbiguousTransfer =
    caseDetail.transfers?.length === 0 && (isAmbiguousTransferIn || isAmbiguousTransferOut);
  const isVerifiedTransfer = !!caseDetail.transfers?.length && caseDetail.transfers.length > 0;

  return (
    <div className="associated-cases">
      {isAssociatedCasesLoading && <LoadingIndicator />}
      {!isAssociatedCasesLoading && consolidation.length === 0 && (
        <Alert
          id="no-cases"
          type={UswdsAlertStyle.Error}
          title="Associated Cases Not Available"
          message="We are unable to retrieve associated cases at this time. Please try again later. If the problem persists, please submit a feedback request describing the issue."
        ></Alert>
      )}
      {isAmbiguousTransfer && (
        <>
          <h3>Transferred Case</h3>
          <p data-testid="ambiguous-transfer-text">
            This case was transferred {isAmbiguousTransferOut ? 'to' : 'from'} another court. Review
            the docket for further details.
          </p>
        </>
      )}
      {isVerifiedTransfer && (
        <div className="record-detail-card-list">
          <ul className="usa-list usa-list--unstyled transfers record-detail-card">
            {caseDetail.transfers?.sort(sortTransfers).map((transfer: Transfer, idx: number) => {
              return (
                <li key={idx} className="transfer">
                  <div className="record-detail-card">
                    <h3 data-testid={`verified-transfer-header_${idx}`}>
                      Transferred {transfer.documentType === 'TRANSFER_FROM' ? 'from' : 'to'}
                    </h3>
                    <div>
                      <span className="case-detail-item-name">Case Number: </span>
                      <CaseNumber
                        caseId={transfer.otherCase.caseId}
                        className="usa-link case-detail-item-value"
                        data-testid={`case-detail-transfer-link-${idx}`}
                      />
                    </div>
                    <div className="transfer-court">
                      <span className="case-detail-item-name">
                        {transfer.documentType === 'TRANSFER_FROM' ? 'Previous' : 'New'} Court:{' '}
                      </span>
                      <span
                        className="case-detail-item-value"
                        data-testid={`case-detail-transfer-court-${idx}`}
                      >
                        {transfer.otherCase.courtName} - {transfer.otherCase.courtDivisionName}
                      </span>
                    </div>
                    <div>
                      <span className="case-detail-item-name">Order Filed: </span>
                      <span
                        className="case-detail-item-value"
                        data-testid={`case-detail-transfer-order-${idx}`}
                      >
                        {formatDate(transfer.orderDate)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {!isAssociatedCasesLoading && consolidation.length > 0 && (
        <>
          <h3>
            {consolidationType} ({consolidation.length})
          </h3>
          <div className="grid-row grid-gap-lg">
            <div className="grid-col-12">
              <table
                className="usa-table usa-table--borderless"
                id="associated-cases-table"
                data-testid="associated-cases-table"
              >
                <thead>
                  <tr>
                    <th scope="col">Case Number (Division)</th>
                    <th scope="col" className="title-column">
                      Case Title
                    </th>
                    <th scope="col">Case Filed</th>
                    <th scope="col">Order Filed</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidation
                    .sort((a, b) =>
                      getCaseNumber(a.otherCase.caseId) > getCaseNumber(b.otherCase.caseId)
                        ? 1
                        : -1,
                    )
                    .sort((a, _b) => (a.documentType === 'CONSOLIDATION_FROM' ? 1 : -1))
                    .map((bCase, idx) => {
                      return (
                        <tr key={idx}>
                          <td className="case-number-column">
                            {bCase.documentType === 'CONSOLIDATION_TO' && (
                              <LeadCaseIcon title={getLeadCaseLabel(consolidationType)} />
                            )}
                            {bCase.documentType === 'CONSOLIDATION_FROM' && (
                              <MemberCaseIcon title={getMemberCaseLabel(consolidationType)} />
                            )}
                            <CaseNumber caseId={bCase.otherCase.caseId} />
                            <span> ({bCase.otherCase.courtDivisionName})</span>
                          </td>
                          <td className="title-column">
                            {bCase.otherCase.caseTitle}
                            {bCase.documentType === 'CONSOLIDATION_TO' && ` (Lead)`}
                          </td>
                          <td>{formatDate(bCase.otherCase.dateFiled)}</td>
                          <td>{formatDate(bCase.orderDate)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
