import { Consolidation, EventCaseReference } from '@common/cams/events';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { consolidationType } from '@/lib/utils/labels';
import './CaseDetailAssociatedCases.scss';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';

export interface CaseDetailAssociatedCasesProps {
  associatedCases: EventCaseReference[];
  isAssociatedCasesLoading: boolean;
}

export default function CaseDetailAssociatedCases(props: CaseDetailAssociatedCasesProps) {
  const { associatedCases, isAssociatedCasesLoading } = props;
  const consolidation: Consolidation[] = associatedCases.filter(
    (c) => c.documentType === 'CONSOLIDATION_FROM' || c.documentType === 'CONSOLIDATION_TO',
  );

  return (
    <div className="associated-cases">
      {isAssociatedCasesLoading && <LoadingIndicator />}
      {!isAssociatedCasesLoading && (
        <>
          <h3>Consolidated cases ({consolidation.length})</h3>
          <h4>{consolidationType.get(consolidation[0].consolidationType)}</h4>
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
                          <td scope="row">
                            <CaseNumber caseId={bCase.otherCase.caseId} />
                            <span> ({bCase.otherCase.courtDivisionName})</span>
                          </td>
                          <td scope="row" className="title-column">
                            {bCase.otherCase.caseTitle}
                            {bCase.documentType === 'CONSOLIDATION_TO' && ` (Lead)`}
                          </td>
                          <td scope="row">{formatDate(bCase.otherCase.dateFiled)}</td>
                          <td scope="row">{formatDate(bCase.orderDate)}</td>
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
