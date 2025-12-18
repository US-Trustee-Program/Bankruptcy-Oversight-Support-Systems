import { useRef } from 'react';
import { TableRow, TableRowData } from '@/lib/components/uswds/Table';
import OpenModalButton from '@/lib/components/uswds/modal/OpenModalButton';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import Actions from '@common/cams/actions';
import { SearchResultsRowProps } from '@/search-results/SearchResults';
import {
  AssignAttorneyModalRef,
  AssignAttorneyModalCallbackProps,
} from '../modal/assignAttorneyModal.types';
import Internal from './StaffAssignmentRow.internal';
import { OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import { CaseAssignment } from '@common/cams/assignments';

export type StaffAssignmentRowOptions = {
  modalId: string;
  modalRef: React.RefObject<AssignAttorneyModalRef | null>;
};

type StaffAssignmentRowProps = SearchResultsRowProps & {
  options: StaffAssignmentRowOptions;
};

export function StaffAssignmentRow(props: StaffAssignmentRowProps) {
  const { bCase, idx, options, ...otherProps } = props;
  const { modalId, modalRef } = options as StaffAssignmentRowOptions;

  const initialState = {
    assignments: bCase.assignments ?? [],
    isLoading: true,
    bCase,
    modalRef,
  };

  const openAssignmentsModalButtonRef = useRef<OpenModalButtonRef>(null);
  const { state, actions } = Internal.useStateActions(initialState);

  function handleAssignmentModalCallback(props: AssignAttorneyModalCallbackProps) {
    actions.updateAssignmentsCallback(props).then(() => {
      modalRef.current?.hide();
    });
  }

  function buildActionButton(assignments: CaseAssignment[] | undefined) {
    const commonModalButtonProps = {
      className: 'case-assignment-modal-toggle',
      buttonIndex: `${idx}`,
      openProps: {
        bCase: { ...bCase, assignments: state.assignments },
        callback: handleAssignmentModalCallback,
      },
      modalId,
      modalRef,
      ref: openAssignmentsModalButtonRef,
    };

    return (
        <OpenModalButton
          uswdsStyle={UswdsButtonStyle.Unstyled}
          aria-label="Edit Staff Assignments"
          title="Edit Staff Assignments"
          {...commonModalButtonProps}
        >
          <IconLabel icon="edit" label="Edit" />
        </OpenModalButton>
      );
  }

  function buildAssignmentList(assignments: Partial<CaseAssignment>[] | undefined) {
    if (assignments && assignments.length > 0) {
      return state.assignments?.map((attorney, key: number) => (
        <span key={key} data-testid={`staff-name-${key}`}>
          {attorney.name}
          <br />
        </span>
      ));
    } else {
      return <span className="unassigned">(unassigned)</span>;
    }
  }

  return (
    <TableRow {...otherProps} key={idx}>
      <TableRowData>
        <span className="no-wrap">
          <CaseNumber caseId={bCase.caseId} /> ({bCase.courtDivisionName})
        </span>
      </TableRowData>
      <TableRowData>{bCase.caseTitle}</TableRowData>
      <TableRowData>{bCase.chapter}</TableRowData>
      <TableRowData>
        {formatDate(bCase.dateFiled)}
      </TableRowData>
      <TableRowData data-testid={`attorney-list-${idx}`} className="attorney-list">
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
