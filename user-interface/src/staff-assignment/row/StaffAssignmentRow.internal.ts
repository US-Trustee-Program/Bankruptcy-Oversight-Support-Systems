import { useApi2 } from '@/lib/hooks/UseApi2';
import Actions from '@common/cams/actions';
import { CallbackProps } from '../modal/AssignAttorneyModal';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { AttorneyUser } from '@common/cams/users';
import { CaseBasics } from '@common/cams/cases';
import { useState } from '@/lib/hooks/UseState';

type State = {
  assignments: AttorneyUser[];
  isLoading: boolean;
  bCase: CaseBasics;
};

type Actions = {
  getCaseAssignments: () => void;
  updateAssignmentsCallback: (props: CallbackProps) => Promise<void>;
};

function useStateActions(initialState: State): {
  state: State;
  actions: Actions;
} {
  const api = useApi2();
  const globalAlert = useGlobalAlert();

  const [state, setState] = useState<State>(initialState);

  async function updateAssignmentsCallback(props: CallbackProps) {
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

      setState({ ...state, assignments: selectedAttorneyList });
      globalAlert?.success(message);
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
      })
      .catch((_reason) => {
        globalAlert?.error(`Could not get staff assignments for case ${state.bCase.caseTitle}`);
        setState({ ...state, isLoading: false });
      });
  }

  const actions = { updateAssignmentsCallback, getCaseAssignments };

  return { state, actions };
}

export const StaffAssignmentRowInternal = {
  useStateActions,
};

export default StaffAssignmentRowInternal;
