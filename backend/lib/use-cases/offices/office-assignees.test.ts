import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import * as factory from '../../factory';
import OfficeAssigneesUseCase from './office-assignees';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MOCKED_USTP_OFFICES_ARRAY } from '@common/cams/offices';
import { CaseAssignment } from '@common/cams/assignments';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import MockData from '@common/cams/test-utilities/mock-data';

describe('OfficeAssigneesUseCase', () => {
  let mockContext: ApplicationContext;
  let createSpy;
  let deleteManySpy;

  beforeEach(async () => {
    // Reset all mocks before each test
    vi.restoreAllMocks();

    // Setup mock context
    mockContext = await createMockApplicationContext();

    createSpy = vi.spyOn(MockMongoRepository.prototype, 'create').mockResolvedValue(undefined);
    deleteManySpy = vi
      .spyOn(MockMongoRepository.prototype, 'deleteMany')
      .mockResolvedValue(undefined);

    vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
      getOffices: vi.fn().mockReturnValue(MOCKED_USTP_OFFICES_ARRAY),
      getOfficeName: vi.fn(),
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
        officeCode: 'USTP_CAMS_Region_18_Office_Seattle',
        caseId: event.caseId,
        userId: event.userId,
        name: event.name,
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
          isCamsError: true,
          module: 'OFFICE-ASSIGNEES-USE-CASE',
          camsStack: expect.arrayContaining([
            {
              message: 'Failed to handle case assignment event.',
              module: 'OFFICE-ASSIGNEES-USE-CASE',
            },
          ]),
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
          isCamsError: true,
          module: 'OFFICE-ASSIGNEES-USE-CASE',
          camsStack: expect.arrayContaining([
            {
              message: 'Failed to handle case closed event.',
              module: 'OFFICE-ASSIGNEES-USE-CASE',
            },
          ]),
        }),
      );
    });
  });
});
