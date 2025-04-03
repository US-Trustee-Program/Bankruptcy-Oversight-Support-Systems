import MockData from '@common/cams/test-utilities/mock-data';
import { StaffAssignmentStore } from './staffAssignmentStore';
import staffAssignmentUseCase from './staffAssignmentUseCase';

describe('staff assignment use case tests', () => {
  test('handleAssignmentChange should call fetchAssignees if assignees were supplied', () => {
    const assignees = MockData.buildArray(MockData.getCamsUserReference, 1);
    const mockStore: StaffAssignmentStore = {
      officeAssignees: [],
      setOfficeAssignees: () => {},
      officeAssigneesError: false,
      setOfficeAssigneesError: () => {},
      staffAssignmentFilter: undefined,
      setStaffAssignmentFilter: () => {},
    };
    const useCase = staffAssignmentUseCase(mockStore);

    const fetchAssigneesSpy = vi.spyOn(useCase, 'fetchAssignees');

    useCase.handleAssignmentChange(assignees);

    expect(fetchAssigneesSpy).toHaveBeenCalled();
  });
});
