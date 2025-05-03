import { CaseNumber } from '@/lib/components/CaseNumber';
import LoadingIndicator from '@/lib/components/LoadingIndicator';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { formatDate } from '@/lib/utils/datetime';

import './CaseDetailAssociatedCases.scss';

import { consolidationTypeMap } from '@/lib/utils/labels';
import { Consolidation, EventCaseReference } from '@common/cams/events';

export interface CaseDetailAssociatedCasesProps {
  associatedCases: EventCaseReference[];
  isAssociatedCasesLoading: boolean;
}

export default function CaseDetailAssociatedCases(props: CaseDetailAssociatedCasesProps) {
  const { associatedCases, isAssociatedCasesLoading } = props;
  const consolidation = associatedCases.filter(
    (c) => c.documentType === 'CONSOLIDATION_FROM' || c.documentType === 'CONSOLIDATION_TO',
  ) as Consolidation[];

  return (
    <div className="associated-cases">
      {isAssociatedCasesLoading && <LoadingIndicator />}
      {!isAssociatedCasesLoading && consolidation.length === 0 && (
        <Alert
          id="no-cases"
          message="We are unable to retrieve associated cases at this time. Please try again later. If the problem persists, please submit a feedback request describing the issue."
          title="Associated Cases Not Available"
          type={UswdsAlertStyle.Error}
        ></Alert>
      )}
      {!isAssociatedCasesLoading && consolidation.length > 0 && (
        <>
          <h3>Consolidated cases ({consolidation.length})</h3>
          <h4>{consolidationTypeMap.get(consolidation[0].consolidationType)}</h4>
          <div className="grid-row grid-gap-lg">
            <div className="grid-col-12">
              <table
                className="usa-table usa-table--borderless"
                data-testid="associated-cases-table"
                id="associated-cases-table"
              >
                <thead>
                  <tr>
                    <th scope="col">Case Number (Division)</th>
                    <th className="title-column" scope="col">
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
                          <td>
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
