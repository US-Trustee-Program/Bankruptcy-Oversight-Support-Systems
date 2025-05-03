import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { useState } from '@/lib/hooks/UseState';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import Actions from '@common/cams/actions';
import { CaseAssignment } from '@common/cams/assignments';
import { CaseBasics } from '@common/cams/cases';
import { CamsRole } from '@common/cams/roles';

import { AssignAttorneyModalCallbackProps } from '../modal/assignAttorneyModal.types';

type Actions = {
  updateAssignmentsCallback: (props: AssignAttorneyModalCallbackProps) => Promise<void>;
};

type State = {
  // TODO: Make assignments a partial of CaseAssignment?? Include on the fields the UI needs to render and the modal needs to make assignments.
  assignments: CaseAssignment[];
  bCase: CaseBasics;
  isLoading: boolean;
};

function useStateActions(initialState: State): {
  actions: Actions;
  state: State;
} {
  const globalAlert = useGlobalAlert();

  const [state, setState] = useState<State>(initialState);

  async function updateAssignmentsCallback(props: AssignAttorneyModalCallbackProps) {
    const { apiResult, bCase, previouslySelectedList, selectedAttorneyList, status } = props;

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
          caseId: bCase.caseId,
          documentType: 'ASSIGNMENT',
          name: attorney.name,
          role: CamsRole.TrialAttorney,
          userId: attorney.id,
        } as CaseAssignment;
      });
      setState({ ...state, assignments });
      globalAlert?.success(message);
    }
  }

  const actions = { updateAssignmentsCallback };

  return { actions, state };
}

export const StaffAssignmentRowInternal = {
  useStateActions,
};

export default StaffAssignmentRowInternal;
