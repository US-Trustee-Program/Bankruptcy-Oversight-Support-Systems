import { StaffAssignmentUseCase } from './staffAssignmentFilterUseCase';
import MockData from '@common/cams/test-utilities/mock-data';
import { UNASSIGNED_OPTION } from './staffAssignmentFilter.types';
import { CamsUserReference } from '@common/cams/users';
import { MOCKED_USTP_OFFICES_ARRAY } from '@common/cams/offices';
import LocalStorage from '@/lib/utils/local-storage';
import Api2 from '@/lib/models/api2';

describe('StaffAssignmentUseCase', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('assigneesToComboOptions', () => {
    test('should include UNASSIGNED option as first element', () => {
      const assignees = MockData.buildArray(MockData.getCamsUserReference, 2);

      const options = StaffAssignmentUseCase.assigneesToComboOptions(assignees);

      expect(options[0]).toEqual(UNASSIGNED_OPTION);
    });

    test('should transform assignees to combo options', () => {
      const assignee = MockData.getCamsUserReference();
      assignee.id = 'test-id';
      assignee.name = 'Test Name';

      const options = StaffAssignmentUseCase.assigneesToComboOptions([assignee]);

      expect(options[1]).toEqual({
        value: 'test-id',
        label: 'Test Name',
      });
    });

    test('should return correct length with UNASSIGNED option', () => {
      const assignees = MockData.buildArray(MockData.getCamsUserReference, 3);

      const options = StaffAssignmentUseCase.assigneesToComboOptions(assignees);

      expect(options).toHaveLength(4); // 3 assignees + UNASSIGNED
    });

    test('should handle empty assignees array', () => {
      const options = StaffAssignmentUseCase.assigneesToComboOptions([]);

      expect(options).toEqual([UNASSIGNED_OPTION]);
    });
  });

  describe('getOfficeAssignees', () => {
    test('should deduplicate assignees from multiple offices', async () => {
      const assignee1: CamsUserReference = {
        id: 'user-1',
        name: 'Alice Smith',
      };
      const assignee2: CamsUserReference = {
        id: 'user-2',
        name: 'Bob Jones',
      };

      vi.spyOn(Api2, 'getOfficeAssignees')
        .mockResolvedValueOnce({ data: [assignee1, assignee2] })
        .mockResolvedValueOnce({ data: [assignee1] }); // Duplicate

      const offices = MOCKED_USTP_OFFICES_ARRAY.slice(0, 2);

      const result = await StaffAssignmentUseCase.getOfficeAssignees(offices);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(assignee1);
      expect(result).toContainEqual(assignee2);
      expect(Api2.getOfficeAssignees).toHaveBeenCalledTimes(2);
    });

    test('should sort assignees alphabetically by name', async () => {
      const assignees: CamsUserReference[] = [
        { id: '1', name: 'Zoe' },
        { id: '2', name: 'Alice' },
        { id: '3', name: 'Bob' },
      ];

      vi.spyOn(Api2, 'getOfficeAssignees').mockResolvedValue({ data: assignees });
      const offices = [MOCKED_USTP_OFFICES_ARRAY[0]];

      const result = await StaffAssignmentUseCase.getOfficeAssignees(offices);

      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Zoe');
    });

    test('should call API function for each office', async () => {
      const assignees = MockData.buildArray(MockData.getCamsUserReference, 2);
      vi.spyOn(Api2, 'getOfficeAssignees').mockResolvedValue({ data: assignees });

      const office1 = { ...MOCKED_USTP_OFFICES_ARRAY[0], officeCode: 'OFF1' };
      const office2 = { ...MOCKED_USTP_OFFICES_ARRAY[1], officeCode: 'OFF2' };
      const offices = [office1, office2];

      await StaffAssignmentUseCase.getOfficeAssignees(offices);

      expect(Api2.getOfficeAssignees).toHaveBeenCalledWith('OFF1');
      expect(Api2.getOfficeAssignees).toHaveBeenCalledWith('OFF2');
      expect(Api2.getOfficeAssignees).toHaveBeenCalledTimes(2);
    });

    test('should handle empty offices array', async () => {
      vi.spyOn(Api2, 'getOfficeAssignees');

      const result = await StaffAssignmentUseCase.getOfficeAssignees([]);

      expect(result).toEqual([]);
      expect(Api2.getOfficeAssignees).not.toHaveBeenCalled();
    });
  });

  describe('fetchAssignees', () => {
    test('should return success when session has offices', async () => {
      const assignees = MockData.buildArray(MockData.getCamsUserReference, 3);
      vi.spyOn(Api2, 'getOfficeAssignees').mockResolvedValue({ data: assignees });
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

      const result = await StaffAssignmentUseCase.fetchAssignees();

      expect(result.success).toBe(true);
      expect(result.assignees).toEqual(assignees.sort((a, b) => (a.name < b.name ? -1 : 1)));
    });

    test('should return failure when session has no offices', async () => {
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
      const apiSpy = vi.spyOn(Api2, 'getOfficeAssignees');

      const result = await StaffAssignmentUseCase.fetchAssignees();

      expect(result.success).toBe(false);
      expect(result.assignees).toBeUndefined();
      expect(apiSpy).not.toHaveBeenCalled();
    });

    test('should return failure when API fails', async () => {
      vi.spyOn(Api2, 'getOfficeAssignees').mockRejectedValue(new Error('API Error'));
      const session = MockData.getCamsSession();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

      const result = await StaffAssignmentUseCase.fetchAssignees();

      expect(result.success).toBe(false);
      expect(result.assignees).toBeUndefined();
    });
  });
});
