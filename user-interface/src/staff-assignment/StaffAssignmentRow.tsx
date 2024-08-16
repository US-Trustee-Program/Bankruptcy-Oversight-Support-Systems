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
import { AssignAttorneyModalRef, CallbackProps } from './modal/AssignAttorneyModal';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { AttorneyUser } from '@common/cams/users';
import { CaseBasics } from '@common/cams/cases';

type State = {
  assignments: AttorneyUser[];
  isLoading: boolean;
  bCase: CaseBasics;
  modalRef: React.RefObject<AssignAttorneyModalRef>;
};

type Actions = {
  getCaseAssignments: () => void;
  updateAssignmentsCallback: (props: CallbackProps) => void;
};

export function useStaffAssignmentRowActions(initialState: State): {
  state: State;
  actions: Actions;
} {
  const api = useApi2();
  const globalAlert = useGlobalAlert();

  const [state, setState] = useState<State>(initialState);

  function updateAssignmentsCallback(props: CallbackProps) {
    const { bCase, selectedAttorneyList, previouslySelectedList, status, apiResult } = props;

    if (status === 'error') {
      globalAlert?.error((apiResult as Error).message);
    } else if (bCase) {
      const messageArr = [];
      const addedAssignments = selectedAttorneyList.filter(
        (staff) => !previouslySelectedList.find((staffObj) => staffObj.id === staff.id),
      );
      const removedAssignments = previouslySelectedList.filter(
        (staff) => !selectedAttorneyList.find((staffObj) => staffObj.id === staff.id),
      );

      if (addedAssignments.length > 0) {
        messageArr.push(
          `${addedAssignments.map((attorney) => attorney.name).join(', ')} assigned to`,
        );
      }
      if (removedAssignments.length > 0) {
        messageArr.push(
          `${removedAssignments.map((attorney) => attorney.name).join(', ')} unassigned from`,
        );
      }
      const message =
        messageArr.join(' case and ') + ` case ${getCaseNumber(bCase.caseId)} ${bCase.caseTitle}.`;

      globalAlert?.success(message);
      state.modalRef.current?.hide();
      getCaseAssignments();
    }
  }

  async function getCaseAssignments() {
    api
      .getCaseAssignments(state.bCase.caseId)
      .then((response) => {
        const assignments = response.data.map((assignment) => {
          return { id: assignment.userId, name: assignment.name };
        });
        setState({ ...state, assignments, isLoading: false });
        state.assignments = assignments;
      })
      .catch((_reason) => {
        globalAlert?.show({
          message: `Could not get staff assignments for case ${state.bCase.caseTitle}`,
          type: UswdsAlertStyle.Error,
          timeout: 8,
        });
        setState({ ...state, isLoading: false });
      });
  }

  const actions = { updateAssignmentsCallback, getCaseAssignments };

  return { state, actions };
}

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

  const initialState: State = {
    assignments: [],
    isLoading: true,
    bCase,
    modalRef,
  };

  const { state, actions } = useStaffAssignmentRowActions(initialState);

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
        <span key={key}>
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
