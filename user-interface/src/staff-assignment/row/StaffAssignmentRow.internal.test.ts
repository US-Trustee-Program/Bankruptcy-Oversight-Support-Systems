import MockData from '@common/cams/test-utilities/mock-data';
import TestingUtilities from '@/lib/testing/testing-utilities';
import Internal from './StaffAssignmentRow.internal';

// TODO: Find an alternative waitFor so we can stop using react testing library for non-React code.
import { waitFor } from '@testing-library/react';
import { CaseAssignment } from '@common/cams/assignments';
import { CamsRole } from '@common/cams/roles';

describe('StaffAssignmentRowInternal', () => {
  const caseId = '081-23-00001';
  const caseAssignments = [
    MockData.getAttorneyAssignment({ id: 'testAssignmentId', caseId, unassignedOn: undefined }),
  ];
  const bCase = MockData.getCaseBasics({ override: { caseId, assignments: caseAssignments } });

  const mappedCaseAssignments = caseAssignments.map((assignment) => {
    return { id: assignment.userId, name: assignment.name };
  });

  const initialState = {
    assignments: [],
    isLoading: true,
    bCase,
    modalRef: {
      current: {
        show: vi.fn(),
        hide: vi.fn(),
      },
    },
  };

  let globalAlert: ReturnType<typeof TestingUtilities.spyOnGlobalAlert>;

  beforeEach(() => {
    TestingUtilities.spyOnUseState();
    globalAlert = TestingUtilities.spyOnGlobalAlert();
  });

  test('should handle successful assignment update', async () => {
    const { state, actions } = Internal.useStateActions(initialState);

    const attorney = MockData.getAttorneyUser();

    // This is a Partial<CaseAssignment> because in the implementation we
    // `as CaseAssignment` a partial object literal for the dirty buffer.
    const endingAssignment: Partial<CaseAssignment> = {
      userId: attorney.id,
      name: attorney.name,
      documentType: 'ASSIGNMENT',
      caseId,
      role: CamsRole.TrialAttorney,
    };
    const endingAssignments = [endingAssignment];

    actions.updateAssignmentsCallback({
      status: 'success',
      apiResult: {},
      bCase,
      leadTrialAttorney: mappedCaseAssignments[0],
      previouslySelectedList: mappedCaseAssignments,
      selectedAttorneyList: endingAssignments.map((assignment) => {
        return { id: assignment.userId!, name: assignment.name! };
      }),
    });

    await waitFor(() => {
      expect(globalAlert.success).toHaveBeenCalled();
      expect(state.assignments).toEqual(expect.arrayContaining(endingAssignments));
      return true;
    });
  });

  test('should handle failed assignment update', async () => {
    const errorMessage = 'failed';

    const { state, actions } = Internal.useStateActions(initialState);
    const startingAssignments = [...state.assignments];

    actions.updateAssignmentsCallback({
      status: 'error',
      apiResult: {
        message: errorMessage,
      },
      bCase,
      leadTrialAttorney: mappedCaseAssignments[0],
      previouslySelectedList: mappedCaseAssignments,
      selectedAttorneyList: mappedCaseAssignments,
    });

    await waitFor(() => {
      expect(globalAlert.error).toHaveBeenCalledWith(errorMessage);
      expect(state.assignments).toEqual(expect.arrayContaining(startingAssignments));
    });
  });

  test('should do nothing when status is success but bCase is undefined', async () => {
    const { actions } = Internal.useStateActions(initialState);

    actions.updateAssignmentsCallback({
      status: 'success',
      apiResult: {},
      bCase: undefined as never,
      leadTrialAttorney: mappedCaseAssignments[0],
      previouslySelectedList: mappedCaseAssignments,
      selectedAttorneyList: mappedCaseAssignments,
    });

    await waitFor(() => {
      expect(globalAlert.success).not.toHaveBeenCalled();
      expect(globalAlert.error).not.toHaveBeenCalled();
    });
  });

  test('should only mention added assignments when no one is removed', async () => {
    const attorney = MockData.getAttorneyUser();
    const { actions } = Internal.useStateActions(initialState);

    actions.updateAssignmentsCallback({
      status: 'success',
      apiResult: {},
      bCase,
      leadTrialAttorney: { id: attorney.id, name: attorney.name },
      previouslySelectedList: [],
      selectedAttorneyList: [{ id: attorney.id, name: attorney.name }],
    });

    await waitFor(() => {
      expect(globalAlert.success).toHaveBeenCalledWith(expect.stringContaining(attorney.name));
      expect(globalAlert.success).toHaveBeenCalledWith(expect.stringContaining('assigned to'));
      expect(globalAlert.success).toHaveBeenCalledWith(expect.not.stringContaining('unassigned'));
    });
  });

  test('should only mention removed assignments when no one is added', async () => {
    const { actions } = Internal.useStateActions(initialState);
    const removedAttorney = mappedCaseAssignments[0];

    actions.updateAssignmentsCallback({
      status: 'success',
      apiResult: {},
      bCase,
      leadTrialAttorney: mappedCaseAssignments[0],
      previouslySelectedList: mappedCaseAssignments,
      selectedAttorneyList: [],
    });

    await waitFor(() => {
      expect(globalAlert.success).toHaveBeenCalledWith(
        expect.stringContaining(removedAttorney.name),
      );
      expect(globalAlert.success).toHaveBeenCalledWith(expect.stringContaining('unassigned from'));
      expect(globalAlert.success).toHaveBeenCalledWith(expect.not.stringContaining('assigned to'));
    });
  });
});
