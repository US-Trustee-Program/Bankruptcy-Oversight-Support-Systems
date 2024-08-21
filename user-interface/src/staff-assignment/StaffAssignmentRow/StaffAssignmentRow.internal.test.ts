import MockData from '@common/cams/test-utilities/mock-data';
import { waitFor } from '@testing-library/react';
import Api2 from '@/lib/hooks/UseApi2';
import { buildResponseBodySuccess } from '@common/api/response';
import { CaseAssignment } from '@common/cams/assignments';
import TestingUtilities from '@/lib/testing/testing-utilities';
import Internal from './StaffAssignmentRow.internal';

describe.only('StaffAssignmentRowInternal', () => {
  const bCase = MockData.getCaseBasics();
  const caseAssignments = [MockData.getAttorneyAssignment()];
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

  TestingUtilities.spyOnUseState();
  const globalAlert = TestingUtilities.spyOnGlobalAlert();

  const apiGetCaseAssignments = vi
    .spyOn(Api2, 'getCaseAssignments')
    .mockResolvedValue(buildResponseBodySuccess<CaseAssignment[]>(caseAssignments));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should get attorneys assigned to the case', async () => {
    const { state, actions } = Internal.useStateActions(initialState);
    actions.getCaseAssignments();

    await waitFor(() => {
      expect(apiGetCaseAssignments).toHaveBeenCalledWith(bCase.caseId);
      expect(state.assignments).toEqual(mappedCaseAssignments);
    });
  });

  test('should show an error message if getting attorney assignments fails', async () => {
    apiGetCaseAssignments.mockRejectedValue('some error');

    const { state, actions } = Internal.useStateActions(initialState);
    actions.getCaseAssignments();

    await waitFor(() => {
      expect(apiGetCaseAssignments).toHaveBeenCalledWith(bCase.caseId);
      expect(state.assignments).toEqual([]);
      expect(globalAlert.error).toHaveBeenCalledWith(
        `Could not get staff assignments for case ${state.bCase.caseTitle}`,
      );
    });
  });

  test('should handle successful assignment update', async () => {
    const { state, actions } = Internal.useStateActions(initialState);
    const endingAssigments = [MockData.getAttorneyUser()];

    actions.updateAssignmentsCallback({
      status: 'success',
      apiResult: {},
      bCase,
      previouslySelectedList: mappedCaseAssignments,
      selectedAttorneyList: endingAssigments,
    });

    await waitFor(() => {
      expect(globalAlert.success).toHaveBeenCalled();
      expect(state.assignments).toEqual(endingAssigments);
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
      previouslySelectedList: mappedCaseAssignments,
      selectedAttorneyList: mappedCaseAssignments,
    });

    await waitFor(() => {
      expect(globalAlert.error).toHaveBeenCalledWith(errorMessage);
      expect(state.assignments).toEqual(startingAssignments);
    });
  });
});
