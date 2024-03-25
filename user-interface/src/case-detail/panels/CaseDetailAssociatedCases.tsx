import { Consolidation, EventCaseReference } from '@common/cams/events';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { consolidationType } from '@/lib/utils/labels';
import './CaseDetailAssociatedCases.scss';

export interface CaseDetailAssociatedCasesProps {
  associatedCases: EventCaseReference[];
}

export default function CaseDetailAssociatedCases(props: CaseDetailAssociatedCasesProps) {
  const { associatedCases } = props;
  const consolidation: Consolidation[] = associatedCases.filter(
    (c) => c.documentType === 'CONSOLIDATION_FROM' || c.documentType === 'CONSOLIDATION_TO',
  );

  return (
    <div className="associated-cases">
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
                .sort((a, b) => (a.otherCase.caseId > b.otherCase.caseId ? 1 : -1))
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
    </div>
  );
}
