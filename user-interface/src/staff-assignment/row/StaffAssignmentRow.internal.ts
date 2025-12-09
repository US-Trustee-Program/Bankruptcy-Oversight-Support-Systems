import Actions from '@common/cams/actions';
import { AssignAttorneyModalCallbackProps } from '../modal/assignAttorneyModal.types';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { CaseBasics } from '@common/cams/cases';
import { useState } from '@/lib/hooks/UseState';
import { CaseAssignment } from '@common/cams/assignments';
import { CamsRole } from '@common/cams/roles';

type State = {
  // TODO: Make assignments a partial of CaseAssignment?? Include on the fields the UI needs to render and the modal needs to make assignments.
  assignments: CaseAssignment[];
  isLoading: boolean;
  bCase: CaseBasics;
};

type Actions = {
  updateAssignmentsCallback: (props: AssignAttorneyModalCallbackProps) => Promise<void>;
};

function useStateActions(initialState: State): {
  state: State;
  actions: Actions;
} {
  const globalAlert = useGlobalAlert();

  const [state, setState] = useState<State>(initialState);

  async function updateAssignmentsCallback(props: AssignAttorneyModalCallbackProps) {
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

      const assignments: CaseAssignment[] = selectedAttorneyList.map((attorney) => {
        return {
          userId: attorney.id,
          name: attorney.name,
          documentType: 'ASSIGNMENT',
          caseId: bCase.caseId,
          role: CamsRole.TrialAttorney,
        } as CaseAssignment;
      });
      setState({ ...state, assignments });
      globalAlert?.success(message);
    }
  }

  const actions = { updateAssignmentsCallback };

  return { state, actions };
}

const StaffAssignmentRowInternal = {
  useStateActions,
};

export default StaffAssignmentRowInternal;
