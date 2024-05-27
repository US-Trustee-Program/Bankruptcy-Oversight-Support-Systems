import { useEffect, useState } from 'react';
import { TableRow, TableRowData, TableRowProps } from '@/lib/components/uswds/Table';
import { ToggleModalButton } from '@/lib/components/uswds/modal/ToggleModalButton';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { CaseWithAssignments } from './CaseAssignmentScreen.types';
import { AssignAttorneyModalRef } from './AssignAttorneyModal';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';

export type AssignAttorneyCasesRowProps = TableRowProps & {
  bCase: CaseWithAssignments;
  idx: number;
  modalId: string;
  modalRef: React.RefObject<AssignAttorneyModalRef>;
};

export function AssignAttorneyCasesRow(props: AssignAttorneyCasesRowProps) {
  const { idx, modalId, modalRef, ...otherProps } = props;

  const [bCase, setBCase] = useState<CaseWithAssignments>(props.bCase);
  const [inTableTransferMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const api = useApi2();

  useEffect(() => {
    api
      .getCaseAssignments(bCase.caseId)
      .then((response) =>
        setBCase({ ...bCase, assignments: response.data.map((assignment) => assignment.name) }),
      )
      .catch((_reason) => {})
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <TableRow className={inTableTransferMode ? 'in-table-transfer-mode' : ''} {...otherProps}>
      <TableRowData className="case-number">
        <span className="mobile-title">Case Number:</span>
        <CaseNumber caseId={bCase.caseId} openLinkIn="same-window" />
      </TableRowData>
      <TableRowData className="chapter" data-testid={`${bCase.caseId}-chapter`}>
        <span className="mobile-title">Chapter:</span>
        {bCase.chapter}
      </TableRowData>
      <TableRowData className="case-title-column">
        <span className="mobile-title">Case Title (Debtor):</span>
        {bCase.caseTitle}
      </TableRowData>
      <TableRowData
        className="filing-date"
        data-sort-value={bCase.dateFiled}
        data-sort-active={true}
      >
        <span className="mobile-title">Filing Date:</span>
        {formatDate(bCase.dateFiled)}
      </TableRowData>
      <TableRowData data-testid={`attorney-list-${idx}`} className="attorney-list">
        <span className="mobile-title">Assigned Attorney:</span>
        {isLoading && (
          <div className="table-flex-container">
            <div className="attorney-list-container">
              <LoadingSpinner caption="Loading..." />
            </div>
            <div className="table-column-toolbar">
              <Button
                uswdsStyle={UswdsButtonStyle.Outline}
                className="case-assignment-modal-toggle"
                title="edit assignments"
                disabled={true}
              >
                Edit
              </Button>
            </div>
          </div>
        )}
        {!isLoading && bCase.assignments && bCase.assignments.length > 0 && (
          <div className="table-flex-container">
            <div className="attorney-list-container">
              {bCase.assignments?.map((attorney, key: number) => (
                <div key={key}>
                  {attorney}
                  <br />
                </div>
              ))}
            </div>
            <div className="table-column-toolbar">
              <ToggleModalButton
                uswdsStyle={UswdsButtonStyle.Outline}
                className="case-assignment-modal-toggle"
                buttonIndex={`${idx}`}
                toggleAction="open"
                toggleProps={{
                  bCase: bCase,
                }}
                modalId={`${modalId}`}
                modalRef={modalRef}
                title="edit assignments"
              >
                Edit
              </ToggleModalButton>
            </div>
          </div>
        )}
        {!isLoading && (!bCase.assignments || !bCase.assignments.length) && (
          <div className="table-flex-container">
            <div className="attorney-list-container">(unassigned)</div>
            <div className="table-column-toolbar">
              <ToggleModalButton
                className="case-assignment-modal-toggle"
                buttonIndex={`${idx}`}
                toggleAction="open"
                toggleProps={{
                  bCase: bCase,
                }}
                modalId={`${modalId}`}
                modalRef={modalRef}
                title="add assignments"
              >
                {}
                Assign
              </ToggleModalButton>
            </div>
          </div>
        )}
      </TableRowData>
    </TableRow>
  );
}
