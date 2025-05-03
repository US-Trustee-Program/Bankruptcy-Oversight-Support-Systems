import { CaseNumber } from '@/lib/components/CaseNumber';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import { OpenModalButton } from '@/lib/components/uswds/modal/OpenModalButton';
import { TableRow, TableRowData } from '@/lib/components/uswds/Table';
import { formatDate } from '@/lib/utils/datetime';
import { SearchResultsRowProps } from '@/search-results/SearchResults';
import Actions from '@common/cams/actions';
import { CaseAssignment } from '@common/cams/assignments';
import { useRef } from 'react';

import {
  AssignAttorneyModalCallbackProps,
  AssignAttorneyModalRef,
} from '../modal/assignAttorneyModal.types';
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
    assignments: bCase.assignments ?? [],
    bCase,
    isLoading: true,
    modalRef,
  };

  const openAssignmentsModalButtonRef = useRef<OpenModalButtonRef>(null);
  const { actions, state } = Internal.useStateActions(initialState);

  function handleAssignmentModalCallback(props: AssignAttorneyModalCallbackProps) {
    actions.updateAssignmentsCallback(props).then(() => {
      modalRef.current?.hide();
    });
  }

  function buildActionButton(assignments: CaseAssignment[] | undefined) {
    const commonModalButtonProps = {
      buttonIndex: `${idx}`,
      className: 'case-assignment-modal-toggle',
      modalId,
      modalRef,
      openProps: {
        bCase: { ...bCase, assignments: state.assignments },
        callback: handleAssignmentModalCallback,
      },
      ref: openAssignmentsModalButtonRef,
    };

    if (assignments && assignments.length > 0) {
      return (
        <OpenModalButton
          {...commonModalButtonProps}
          title="Edit Staff Assignments"
          uswdsStyle={UswdsButtonStyle.Outline}
        >
          Edit
        </OpenModalButton>
      );
    } else {
      return (
        <OpenModalButton {...commonModalButtonProps} title="Add Staff Assignments">
          Assign
        </OpenModalButton>
      );
    }
  }

  function buildAssignmentList(assignments: Partial<CaseAssignment>[] | undefined) {
    if (assignments && assignments.length > 0) {
      return state.assignments?.map((attorney, key: number) => (
        <span data-testid={`staff-name-${key}`} key={key}>
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
      <TableRowData aria-sort="descending" dataSortValue={bCase.caseId.replace(/-/g, '')}>
        <span className="no-wrap">
          <CaseNumber caseId={bCase.caseId} /> ({bCase.courtDivisionName})
        </span>
      </TableRowData>
      <TableRowData>{bCase.caseTitle}</TableRowData>
      <TableRowData>{bCase.chapter}</TableRowData>
      <TableRowData aria-sort="descending" dataSortValue={bCase.dateFiled.replace(/-/g, '')}>
        {formatDate(bCase.dateFiled)}
      </TableRowData>
      <TableRowData className="attorney-list" data-testid={`attorney-list-${idx}`}>
        <span className="mobile-title">Assigned Attorney:</span>
        <div className="table-flex-container">
          <div className="attorney-list-container">{buildAssignmentList(state.assignments)}</div>
          <div className="table-column-toolbar">
            {Actions.contains(bCase, Actions.ManageAssignments) &&
              buildActionButton(state.assignments)}
          </div>
        </div>
      </TableRowData>
    </TableRow>
  );
}
