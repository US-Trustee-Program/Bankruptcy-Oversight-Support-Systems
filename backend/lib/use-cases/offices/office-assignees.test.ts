import { ApplicationContext } from '../../adapters/types/basic';
import * as factory from '../../factory';
import OfficeAssigneesUseCase from './office-assignees';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OfficeAssigneesRepository } from '../gateways.types';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import { MOCKED_USTP_OFFICES_ARRAY } from '../../../../common/src/cams/offices';

describe('OfficeAssigneesUseCase', () => {
  let mockContext: ApplicationContext;
  let mockRepo: OfficeAssigneesRepository;
  let mockGateway: {
    getOffices: jest.Mock;
    getOfficeName: jest.Mock;
  };
  let getOfficeAssigneesRepositorySpy: jest.SpyInstance;
  let getOfficesGatewaySpy: jest.SpyInstance;

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Setup mock context
    mockContext = await createMockApplicationContext();

    // Setup mock repository
    mockRepo = {
      create: jest.fn(),
      deleteMany: jest.fn(),
      getDistinctAssigneesByOffice: jest.fn(),
      search: jest.fn(),
      release: jest.fn(),
    };
    getOfficeAssigneesRepositorySpy = jest
      .spyOn(factory, 'getOfficeAssigneesRepository')
      .mockReturnValue(mockRepo);

    // Setup mock gateway
    mockGateway = {
      getOffices: jest.fn(),
      getOfficeName: jest.fn(),
    };
    getOfficesGatewaySpy = jest.spyOn(factory, 'getOfficesGateway').mockReturnValue(mockGateway);
  });

  afterEach(() => {
    // Restore all spies
    getOfficeAssigneesRepositorySpy.mockRestore();
    getOfficesGatewaySpy.mockRestore();
  });

  describe('handleCaseAssignmentEvent', () => {
    test('should create a case assignment when unassignedOn is not provided', async () => {
      // Setup
      mockGateway.getOffices.mockResolvedValue(MOCKED_USTP_OFFICES_ARRAY);

      const event = MockData.getAttorneyAssignment({
        unassignedOn: undefined,
        caseId: '812-11-22222', // Using a valid division code from MOCKED_USTP_OFFICES_ARRAY
      });

      // Execute
      await OfficeAssigneesUseCase.handleCaseAssignmentEvent(mockContext, event);

      // Verify
      expect(mockRepo.create).toHaveBeenCalledWith({
        officeCode: 'USTP_CAMS_Region_18_Office_Seattle',
        caseId: event.caseId,
        userId: event.userId,
        name: event.name,
      });
      expect(mockRepo.deleteMany).not.toHaveBeenCalled();
    });

    test('should delete a case assignment when unassignedOn is provided', async () => {
      // Setup
      mockGateway.getOffices.mockResolvedValue(MOCKED_USTP_OFFICES_ARRAY);

      const event = MockData.getAttorneyAssignment({
        caseId: '812-11-22222', // Using a valid division code from MOCKED_USTP_OFFICES_ARRAY
      });

      // Execute
      await OfficeAssigneesUseCase.handleCaseAssignmentEvent(mockContext, event);

      // Verify
      expect(mockRepo.deleteMany).toHaveBeenCalledWith({
        caseId: event.caseId,
        userId: event.userId,
      });
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    test('should throw an error when office mapping fails', async () => {
      // Setup
      mockGateway.getOffices.mockResolvedValue(MOCKED_USTP_OFFICES_ARRAY);

      const event = MockData.getAttorneyAssignment({
        caseId: '999-11-22222', // Using a case ID that won't match any office
      });

      // Execute and Verify
      await expect(
        OfficeAssigneesUseCase.handleCaseAssignmentEvent(mockContext, event),
      ).rejects.toThrow();
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
      expect(mockRepo.deleteMany).toHaveBeenCalledWith({
        caseId: event.caseId,
      });
    });

    test('should throw an error when deletion fails', async () => {
      // Setup
      const event = {
        caseId: MockData.randomCaseId(),
      };
      (mockRepo.deleteMany as jest.Mock).mockRejectedValue(new Error('Deletion failed'));

      // Execute and Verify
      await expect(
        OfficeAssigneesUseCase.handleCaseClosedEvent(mockContext, event),
      ).rejects.toThrow();
    });
  });
});
