import TestingUtilities from '@/lib/testing/testing-utilities';
import { CaseAssignment } from '@common/cams/assignments';
import { CamsRole } from '@common/cams/roles';
import MockData from '@common/cams/test-utilities/mock-data';
// TODO: Find an alternative waitFor so we can stop using react testing library for non-React code.
import { waitFor } from '@testing-library/react';

import Internal from './StaffAssignmentRow.internal';

describe('StaffAssignmentRowInternal', () => {
  const caseId = 'testCaseId';
  const caseAssignments = [
    MockData.getAttorneyAssignment({ caseId, id: 'testAssignmentId', unassignedOn: undefined }),
  ];
  const bCase = MockData.getCaseBasics({ override: { assignments: caseAssignments, caseId } });

  const mappedCaseAssignments = caseAssignments.map((assignment) => {
    return { id: assignment.userId, name: assignment.name };
  });

  const initialState = {
    assignments: [],
    bCase,
    isLoading: true,
    modalRef: {
      current: {
        hide: vi.fn(),
        show: vi.fn(),
      },
    },
  };

  TestingUtilities.spyOnUseState();
  const globalAlert = TestingUtilities.spyOnGlobalAlert();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should handle successful assignment update', async () => {
    const { actions, state } = Internal.useStateActions(initialState);

    const attorney = MockData.getAttorneyUser();

    // This is a Partial<CaseAssignment> because in the implementation we
    // `as CaseAssignment` a partial object literal for the dirty buffer.
    const endingAssignment: Partial<CaseAssignment> = {
      caseId,
      documentType: 'ASSIGNMENT',
      name: attorney.name,
      role: CamsRole.TrialAttorney,
      userId: attorney.id,
    };
    const endingAssignments = [endingAssignment];

    actions.updateAssignmentsCallback({
      apiResult: {},
      bCase,
      previouslySelectedList: mappedCaseAssignments,
      selectedAttorneyList: endingAssignments.map((assignment) => {
        return { id: assignment.userId!, name: assignment.name! };
      }),
      status: 'success',
    });

    await waitFor(() => {
      expect(globalAlert.success).toHaveBeenCalled();
      expect(state.assignments).toEqual(expect.arrayContaining(endingAssignments));
      return true;
    });
  });

  test('should handle failed assignment update', async () => {
    const errorMessage = 'failed';

    const { actions, state } = Internal.useStateActions(initialState);
    const startingAssignments = [...state.assignments];

    actions.updateAssignmentsCallback({
      apiResult: {
        message: errorMessage,
      },
      bCase,
      previouslySelectedList: mappedCaseAssignments,
      selectedAttorneyList: mappedCaseAssignments,
      status: 'error',
    });

    await waitFor(() => {
      expect(globalAlert.error).toHaveBeenCalledWith(errorMessage);
      expect(state.assignments).toEqual(expect.arrayContaining(startingAssignments));
    });
  });
});
