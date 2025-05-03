import { CaseAssignment } from '../../../../common/src/cams/assignments';
import { MOCKED_USTP_OFFICES_ARRAY } from '../../../../common/src/cams/offices';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import * as factory from '../../factory';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import OfficeAssigneesUseCase from './office-assignees';

describe('OfficeAssigneesUseCase', () => {
  let mockContext: ApplicationContext;
  let createSpy;
  let deleteManySpy;

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.restoreAllMocks();

    // Setup mock context
    mockContext = await createMockApplicationContext();

    createSpy = jest.spyOn(MockMongoRepository.prototype, 'create').mockResolvedValue(undefined);
    deleteManySpy = jest
      .spyOn(MockMongoRepository.prototype, 'deleteMany')
      .mockResolvedValue(undefined);

    jest.spyOn(factory, 'getOfficesGateway').mockReturnValue({
      getOfficeName: jest.fn(),
      getOffices: jest.fn().mockReturnValue(MOCKED_USTP_OFFICES_ARRAY),
    });
  });

  describe('handleCaseAssignmentEvent', () => {
    test('should create a case assignment when unassignedOn is not provided', async () => {
      // Setup
      const event: CaseAssignment = MockData.getAttorneyAssignment({
        caseId: '812-00-00001',
        unassignedOn: undefined,
      });

      // Execute
      await OfficeAssigneesUseCase.handleCaseAssignmentEvent(mockContext, event);

      // Verify
      expect(createSpy).toHaveBeenCalledWith({
        caseId: event.caseId,
        name: event.name,
        officeCode: 'USTP_CAMS_Region_18_Office_Seattle',
        userId: event.userId,
      });
      expect(deleteManySpy).not.toHaveBeenCalled();
    });

    test('should delete a case assignment when unassignedOn is provided', async () => {
      // Setup
      const event = MockData.getAttorneyAssignment({
        caseId: '812-11-22222', // Using a valid division code from MOCKED_USTP_OFFICES_ARRAY
        unassignedOn: '2024-01-01',
      });

      // Execute
      await OfficeAssigneesUseCase.handleCaseAssignmentEvent(mockContext, event);

      // Verify
      expect(deleteManySpy).toHaveBeenCalledWith({
        caseId: event.caseId,
        userId: event.userId,
      });
      expect(createSpy).not.toHaveBeenCalled();
    });

    test('should throw an error when office mapping fails', async () => {
      // Setup
      const event = MockData.getAttorneyAssignment({ caseId: '999-00-00001' });

      // Execute and Verify
      await expect(
        OfficeAssigneesUseCase.handleCaseAssignmentEvent(mockContext, event),
      ).rejects.toThrow(
        expect.objectContaining({
          camsStack: expect.arrayContaining([
            {
              message: 'Failed to handle case assignment event.',
              module: 'OFFICE-ASSIGNEES-USE-CASE',
            },
          ]),
          isCamsError: true,
          module: 'OFFICE-ASSIGNEES-USE-CASE',
        }),
      );
    });
  });

  describe('handleCaseClosedEvent', () => {
    test('should delete all assignments for a closed case', async () => {
      // Setup
      const event = {
        caseId: MockData.randomCaseId(),
      };

      // Execute
      await OfficeAssigneesUseCase.handleCaseClosedEvent(mockContext, event);

      // Verify
      expect(deleteManySpy).toHaveBeenCalledWith({
        caseId: event.caseId,
      });
    });

    test('should throw an error when deletion fails', async () => {
      // Setup
      const event = {
        caseId: MockData.randomCaseId(),
      };
      deleteManySpy.mockRejectedValue(new Error('Deletion failed'));

      // Execute and Verify
      await expect(
        OfficeAssigneesUseCase.handleCaseClosedEvent(mockContext, event),
      ).rejects.toThrow(
        expect.objectContaining({
          camsStack: expect.arrayContaining([
            {
              message: 'Failed to handle case closed event.',
              module: 'OFFICE-ASSIGNEES-USE-CASE',
            },
          ]),
          isCamsError: true,
          module: 'OFFICE-ASSIGNEES-USE-CASE',
        }),
      );
    });
  });
});
