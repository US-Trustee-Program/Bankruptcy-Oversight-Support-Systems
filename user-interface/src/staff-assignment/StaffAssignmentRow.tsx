import { useEffect, useState } from 'react';
import { TableRow, TableRowData } from '@/lib/components/uswds/Table';
import { ToggleModalButton } from '@/lib/components/uswds/modal/ToggleModalButton';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Actions from '@common/cams/actions';
import { SearchResultsRowProps } from '@/search-results/SearchResults';
import { AssignAttorneyModalRef } from './modal/AssignAttorneyModal';
import { CaseBasics } from '@common/cams/cases';

export type StaffAssignmentRowOptions = {
  modalId: string;
  modalRef: React.RefObject<AssignAttorneyModalRef>;
};

export type StaffAssignmentRowProps = SearchResultsRowProps & {
  options: StaffAssignmentRowOptions;
};

function deepCopy(obj: object) {
  return JSON.parse(JSON.stringify(obj));
}

export function StaffAssignmentRow(props: StaffAssignmentRowProps) {
  const { bCase, idx, options, ...otherProps } = props;
  const { modalId, modalRef } = options as StaffAssignmentRowOptions;
  if (idx === 0) console.log(`loading row ${idx}`);

  const [bCaseCopy, setBCaseCopy] = useState<CaseBasics>(deepCopy(bCase));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const api = useApi2();

  useEffect(() => {
    if (!isLoading) return;
    api
      .getCaseAssignments(bCase.caseId)
      .then((response) => {
        const assignments = response.data.map((assignment) => {
          return { id: assignment.userId, name: assignment.name };
        });
        setBCaseCopy({ ...bCaseCopy, assignments });
      })
      .catch((_reason) => {})
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  let assignmentJsx;
  let actionButton;

  const commonModalButtonProps = {
    className: 'case-assignment-modal-toggle',
    buttonIndex: `toggle-button-${idx}`,
    toggleProps: { bCase: bCaseCopy },
    modalId,
    modalRef,
  };

  if (bCaseCopy.assignments && bCaseCopy.assignments.length > 0) {
    assignmentJsx = bCaseCopy.assignments?.map((attorney, key: number) => (
      <span key={key}>
        {attorney.name}
        <br />
      </span>
    ));
    actionButton = (
      <ToggleModalButton
        {...commonModalButtonProps}
        uswdsStyle={UswdsButtonStyle.Outline}
        toggleAction="open"
        title="edit assignments"
      >
        Edit
      </ToggleModalButton>
    );
  } else {
    assignmentJsx = <>(unassigned)</>;
    actionButton = (
      <ToggleModalButton {...commonModalButtonProps} toggleAction="open" title="add assignments">
        Assign
      </ToggleModalButton>
    );
  }

  return (
    <TableRow {...otherProps} key={idx}>
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
            <div className="attorney-list-container">{assignmentJsx}</div>
            <div className="table-column-toolbar">
              {Actions.contains(bCase, Actions.ManageAssignments) && actionButton}
            </div>
          </div>
        )}
      </TableRowData>
    </TableRow>
  );
}
