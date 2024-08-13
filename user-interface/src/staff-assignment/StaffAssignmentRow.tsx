import { useEffect, useState } from 'react';
import { TableRow, TableRowData } from '@/lib/components/uswds/Table';
import { ToggleModalButton } from '@/lib/components/uswds/modal/ToggleModalButton';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { CaseBasics } from '@common/cams/cases';
import Actions from '@common/cams/actions';
import { SearchResultsRowProps } from '@/search-results/SearchResults';
import { AssignAttorneyModalRef } from './modal/AssignAttorneyModal';

export type StaffAssignmentRowOptions = {
  modalId: string;
  modalRef: React.RefObject<AssignAttorneyModalRef>;
};

export type StaffAssignmentRowProps = SearchResultsRowProps & {
  options: StaffAssignmentRowOptions;
};

export function StaffAssignmentRow(props: StaffAssignmentRowProps) {
  const { bCase, idx, options, ...otherProps } = props;
  const { modalId, modalRef } = options;

  const [internalCase, setBCase] = useState<CaseBasics>({ ...bCase });
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
        buttonIndex={`toggle-button-${idx}`}
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
        buttonIndex={`toggle-button-${idx}`}
        toggleAction="open"
        toggleProps={{
          bCase: internalCase,
        }}
        modalId={`${modalId}`}
        modalRef={modalRef}
        title="add assignments"
      >
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
