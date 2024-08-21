import { useEffect } from 'react';
import { TableRow, TableRowData } from '@/lib/components/uswds/Table';
import { ToggleModalButton } from '@/lib/components/uswds/modal/ToggleModalButton';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Actions from '@common/cams/actions';
import { SearchResultsRowProps } from '@/search-results/SearchResults';
import { AssignAttorneyModalRef } from '../modal/AssignAttorneyModal';
import { AttorneyUser } from '@common/cams/users';
import Internal from './StaffAssignmentRow.internal';

export type StaffAssignmentRowOptions = {
  modalId: string;
  modalRef: React.RefObject<AssignAttorneyModalRef>;
};

export type StaffAssignmentRowProps = SearchResultsRowProps & {
  options: StaffAssignmentRowOptions;
};

export function StaffAssignmentRow(props: StaffAssignmentRowProps) {
  const { bCase, idx, options, ...otherProps } = props;
  const { modalId, modalRef } = options as StaffAssignmentRowOptions;

  const initialState = {
    assignments: [],
    isLoading: true,
    bCase,
    modalRef,
  };

  const { state, actions } = Internal.useStateActions(initialState);

  useEffect(() => {
    actions.getCaseAssignments();
  }, []);

  function buildActionButton(assignments: AttorneyUser[]) {
    const commonModalButtonProps = {
      className: 'case-assignment-modal-toggle',
      buttonIndex: `toggle-button-${idx}`,
      toggleProps: {
        bCase: { ...bCase, assignments: state.assignments },
        callback: actions.updateAssignmentsCallback,
      },
      modalId,
      modalRef,
    };

    if (assignments.length > 0) {
      return (
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
      return (
        <ToggleModalButton {...commonModalButtonProps} toggleAction="open" title="add assignments">
          Assign
        </ToggleModalButton>
      );
    }
  }

  function buildAssignmentList(assignments: AttorneyUser[]) {
    if (assignments.length > 0) {
      return state.assignments?.map((attorney, key: number) => (
        <span key={key} data-testid={`staff-name-${key}`}>
          {attorney.name}
          <br />
        </span>
      ));
    } else {
      return <>(unassigned)</>;
    }
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
        {state.isLoading && (
          <div className="table-flex-container">
            <div className="attorney-list-container">
              <LoadingSpinner caption="Loading..." />
            </div>
          </div>
        )}
        {!state.isLoading && (
          <div className="table-flex-container">
            <div className="attorney-list-container">{buildAssignmentList(state.assignments)}</div>
            <div className="table-column-toolbar">
              {Actions.contains(bCase, Actions.ManageAssignments) &&
                buildActionButton(state.assignments)}
            </div>
          </div>
        )}
      </TableRowData>
    </TableRow>
  );
}
