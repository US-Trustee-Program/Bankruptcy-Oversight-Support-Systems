import { createMockApplicationContext } from '../../testing/testing-utilities';
import AttorneysList from './attorneys';
import { CaseAssignmentUseCase } from '../case-assignment/case-assignment';
import * as factory from '../../factory';
import { Staff } from '../../../../common/src/cams/users';
import { CamsRole } from '../../../../common/src/cams/roles';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';

describe('Test attorneys use-case', () => {
  const mockStaffRepository = {
    getAttorneyStaff: jest.fn(),
  };

  test('Should use staff repository passed to it in constructor', async () => {
    // Use proper mock utilities to create Staff objects for attorneys
    const mockStaff: Staff[] = [
      MockData.getStaffAssignee({
        id: 'attorney-1',
        name: 'John Attorney',
        roles: [CamsRole.TrialAttorney],
      }),
      MockData.getStaffAssignee({
        id: 'attorney-2',
        name: 'Jane Attorney',
        roles: [CamsRole.TrialAttorney],
      }),
    ];

    jest.spyOn(factory, 'getStaffRepository').mockReturnValue(mockStaffRepository);
    mockStaffRepository.getAttorneyStaff.mockResolvedValue(mockStaff);
    jest.spyOn(CaseAssignmentUseCase.prototype, 'getCaseLoad').mockResolvedValue(5);

    const mockContext = await createMockApplicationContext();
    const caseList = new AttorneysList();
    const results = await caseList.getAttorneyList(mockContext);

    // Convert expected results to AttorneyUser format (with offices array and caseLoad)
    const expectedResults = mockStaff.map((staff) => ({
      ...staff,
      offices: [],
      caseLoad: 5, // This comes from the mocked CaseAssignmentUseCase.getCaseLoad
    }));

    expect(results).toEqual(expectedResults);
  });

  test('should log errors when looking up attorney assignments', async () => {
    // Convert TRIAL_ATTORNEYS to Staff objects (the format expected by StaffRepository)
    const mockStaff: Staff[] = [
      MockData.getStaffAssignee({
        id: 'attorney-1',
        name: 'John Attorney',
        roles: [CamsRole.TrialAttorney],
      }),
      MockData.getStaffAssignee({
        id: 'attorney-2',
        name: 'Jane Attorney',
        roles: [CamsRole.TrialAttorney],
      }),
    ];

    jest.spyOn(factory, 'getStaffRepository').mockReturnValue(mockStaffRepository);
    mockStaffRepository.getAttorneyStaff.mockResolvedValue(mockStaff);

    const mockContext = await createMockApplicationContext();
    const loggerSpy = jest.spyOn(mockContext.logger, 'error');

    const assignmentUseCaseSpy = jest
      .spyOn(CaseAssignmentUseCase.prototype, 'getCaseLoad')
      .mockRejectedValue(new Error('TEST'));

    const caseList = new AttorneysList();
    await caseList.getAttorneyList(mockContext);

    expect(assignmentUseCaseSpy).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalled();
  });

  describe('AttorneysList - StaffRepository Integration', () => {
    beforeEach(() => {
      jest.spyOn(factory, 'getStaffRepository').mockReturnValue(mockStaffRepository);
      jest.spyOn(CaseAssignmentUseCase.prototype, 'getCaseLoad').mockResolvedValue(5);
    });

    test('should get attorneys from staff repository', async () => {
      const mockStaff: Staff[] = [
        {
          id: 'attorney-1',
          name: 'John Attorney',
          roles: [CamsRole.TrialAttorney],
        },
        {
          id: 'attorney-2',
          name: 'Jane Attorney',
          roles: [CamsRole.TrialAttorney],
        },
      ];

      mockStaffRepository.getAttorneyStaff.mockResolvedValue(mockStaff);

      const mockContext = await createMockApplicationContext();
      const attorneysList = new AttorneysList();
      const result = await attorneysList.getAttorneyList(mockContext);

      expect(mockStaffRepository.getAttorneyStaff).toHaveBeenCalledWith(mockContext);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'attorney-1',
        name: 'John Attorney',
        roles: [CamsRole.TrialAttorney],
        offices: [],
        caseLoad: 5,
      });
      expect(result[1]).toEqual({
        id: 'attorney-2',
        name: 'Jane Attorney',
        roles: [CamsRole.TrialAttorney],
        offices: [],
        caseLoad: 5,
      });
    });

    test('should handle staff repository errors', async () => {
      const mockError = new Error('Staff repository error');
      mockStaffRepository.getAttorneyStaff.mockRejectedValue(mockError);

      const mockContext = await createMockApplicationContext();
      const attorneysList = new AttorneysList();

      await expect(attorneysList.getAttorneyList(mockContext)).rejects.toThrow(
        'Staff repository error',
      );
    });

    test('should convert Staff to AttorneyUser correctly', async () => {
      const mockStaff: Staff[] = [
        {
          id: 'attorney-1',
          name: 'John Attorney',
          roles: [CamsRole.TrialAttorney, CamsRole.DataVerifier],
        },
      ];

      mockStaffRepository.getAttorneyStaff.mockResolvedValue(mockStaff);

      const mockContext = await createMockApplicationContext();
      const attorneysList = new AttorneysList();
      const result = await attorneysList.getAttorneyList(mockContext);

      // Verify Staff to AttorneyUser transformation
      expect(result[0]).toEqual({
        id: 'attorney-1',
        name: 'John Attorney',
        roles: [CamsRole.TrialAttorney, CamsRole.DataVerifier],
        offices: [], // Should be empty array as specified in design
        caseLoad: 5,
      });
    });

    test('should handle case load retrieval errors for individual attorneys', async () => {
      const mockStaff: Staff[] = [
        {
          id: 'attorney-1',
          name: 'John Attorney',
          roles: [CamsRole.TrialAttorney],
        },
        {
          id: 'attorney-2',
          name: 'Jane Attorney',
          roles: [CamsRole.TrialAttorney],
        },
      ];

      mockStaffRepository.getAttorneyStaff.mockResolvedValue(mockStaff);

      // Mock case load error for first attorney but success for second
      jest
        .spyOn(CaseAssignmentUseCase.prototype, 'getCaseLoad')
        .mockRejectedValueOnce(new Error('Case load error'))
        .mockResolvedValueOnce(3);

      const mockContext = await createMockApplicationContext();
      const loggerSpy = jest.spyOn(mockContext.logger, 'error');

      const attorneysList = new AttorneysList();
      const result = await attorneysList.getAttorneyList(mockContext);

      // Should still return both attorneys, with undefined case load for the errored one
      expect(result).toHaveLength(2);
      expect(result[0].caseLoad).toBeUndefined();
      expect(result[1].caseLoad).toBe(3);
      expect(loggerSpy).toHaveBeenCalledWith(
        'ATTORNEYS-USE-CASE',
        'Unable to retrieve attorney case load.',
        expect.any(Error),
      );
    });
  });
});
