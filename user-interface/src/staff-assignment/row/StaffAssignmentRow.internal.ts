import Actions from '@common/cams/actions';
import { CallbackProps } from '../modal/AssignAttorneyModal';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { getCaseNumber } from '@/lib/utils/caseNumber';
import { CaseBasics } from '@common/cams/cases';
import { useState } from '@/lib/hooks/UseState';
import { CaseAssignment } from '@common/cams/assignments';
import { CamsRole } from '@common/cams/roles';

type State = {
  assignments: CaseAssignment[];
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

      const assignments: CaseAssignment[] = selectedAttorneyList.map((attorney) => {
        return {
          userId: attorney.id,
          name: attorney.name,
          documentType: 'ASSIGNMENT',
          caseId: bCase.caseId,
          role: CamsRole.TrialAttorney,
          assignedOn: new Date().toString(),
        } as CaseAssignment;
      });
      setState({ ...state, assignments });
      globalAlert?.success(message);
    }
  }

  async function getCaseAssignments() {
    setState({ ...state, assignments: state.bCase.assignments ?? [], isLoading: false });
  }

  const actions = { updateAssignmentsCallback, getCaseAssignments };

  return { state, actions };
}

export const StaffAssignmentRowInternal = {
  useStateActions,
};

export default StaffAssignmentRowInternal;
