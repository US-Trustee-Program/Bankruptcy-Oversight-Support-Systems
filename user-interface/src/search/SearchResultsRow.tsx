import { useEffect, useState } from 'react';
import { TableRow, TableRowData, TableRowProps } from '@/lib/components/uswds/Table';
import { ToggleModalButton } from '@/lib/components/uswds/modal/ToggleModalButton';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { CaseBasics } from '@common/cams/cases';
import Actions from '@common/cams/actions';
import { AssignAttorneyModalRef } from '@/my-cases/assign-attorney/AssignAttorneyModal';

export type SearchResultsRowProps = TableRowProps & {
  bCase: CaseBasics;
  idx: number;
  modalId: string;
  modalRef: React.RefObject<AssignAttorneyModalRef>;
};

export function SearchResultsRow(props: SearchResultsRowProps) {
  const { bCase, idx, modalId, modalRef, ...otherProps } = props;

  const [internalCase, setBCase] = useState<CaseBasics>(bCase);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const api = useApi2();

  useEffect(() => {
    api
      .getCaseAssignments(internalCase.caseId)
      .then((response) =>
        setBCase({
          ...internalCase,
          assignments: response.data.map((assignment) => {
            return { id: assignment.userId, name: assignment.name };
          }),
        }),
      )
      .catch((_reason) => {})
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  let assignments;
  let actionButton;

  if (internalCase.assignments && internalCase.assignments.length > 0) {
    assignments = internalCase.assignments?.map((attorney, key: number) => (
      <span key={key}>
        {attorney.name}
        <br />
      </span>
    ));
    actionButton = (
      <ToggleModalButton
        uswdsStyle={UswdsButtonStyle.Outline}
        className="case-assignment-modal-toggle"
        buttonIndex={`${idx}`}
        toggleAction="open"
        toggleProps={{
          bCase: internalCase,
        }}
        modalId={`${modalId}`}
        modalRef={modalRef}
        title="edit assignments"
      >
        Edit
      </ToggleModalButton>
    );
  } else {
    assignments = <>(unassigned)</>;
    actionButton = (
      <ToggleModalButton
        className="case-assignment-modal-toggle"
        buttonIndex={`${idx}`}
        toggleAction="open"
        toggleProps={{
          bCase: internalCase,
        }}
        modalId={`${modalId}`}
        modalRef={modalRef}
        title="add assignments"
      >
        {}
        Assign
      </ToggleModalButton>
    );
  }

  return (
    <TableRow {...otherProps}>
      {/*
      <TableRowData className="case-number">
        <span className="mobile-title">Case Number:</span>
        <CaseNumber caseId={internalCase.caseId} openLinkIn="same-window" />
      </TableRowData>
      <TableRowData className="chapter" data-testid={`${internalCase.caseId}-chapter`}>
        <span className="mobile-title">Chapter:</span>
        {internalCase.chapter}
      </TableRowData>
      <TableRowData className="case-title-column">
        <span className="mobile-title">Case Title (Debtor):</span>
        {internalCase.caseTitle}
      </TableRowData>
      <TableRowData
        className="filing-date"
        data-sort-value={internalCase.dateFiled}
        data-sort-active={true}
      >
        <span className="mobile-title">Filing Date:</span>
        {formatDate(internalCase.dateFiled)}
      </TableRowData>
      */}
      <TableRowData dataSortValue={bCase.caseId}>
        <span className="no-wrap">
          <CaseNumber caseId={bCase.caseId} /> ({bCase.courtDivisionName})
        </span>
      </TableRowData>
      <TableRowData>{bCase.caseTitle}</TableRowData>
      <TableRowData>{bCase.chapter}</TableRowData>
      <TableRowData>{formatDate(bCase.dateFiled)}</TableRowData>
      <TableRowData data-testid={`attorney-list-${idx}`} className="attorney-list">
        <span className="mobile-title">Assigned Attorney:</span>
        {isLoading && (
          <div className="table-flex-container">
            <div className="attorney-list-container">
              <LoadingSpinner caption="Loading..." />
            </div>
          </div>
        )}
        {!isLoading && (
          <div className="table-flex-container">
            <div className="attorney-list-container">{assignments}</div>
            <div className="table-column-toolbar">
              {Actions.contains(internalCase, Actions.ManageAssignments) && actionButton}
            </div>
          </div>
        )}
      </TableRowData>
    </TableRow>
  );
}
