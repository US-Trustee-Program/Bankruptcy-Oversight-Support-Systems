import { ApplicationContext } from '../../adapters/types/basic';
import * as factory from '../../factory';
import OfficeAssigneesUseCase from './office-assignees';
import { CaseAssignment } from '../../../../common/src/cams/assignments';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OfficeAssigneesRepository } from '../gateways.types';
import { UstpOfficeDetails } from '../../../../common/src/cams/offices';

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
    it('should create a case assignment when unassignedOn is not provided', async () => {
      // Setup
      const mockOffices: UstpOfficeDetails[] = [
        {
          officeCode: 'TEST',
          officeName: 'Test Office',
          groups: [
            {
              groupDesignator: 'TEST',
              divisions: [
                {
                  divisionCode: '000',
                  court: { courtId: 'TEST' },
                  courtOffice: { courtOfficeCode: 'TEST', courtOfficeName: 'Test Office' },
                },
              ],
            },
          ],
          idpGroupName: 'Test Group',
          regionId: 'TEST',
          regionName: 'Test Region',
        },
      ];
      mockGateway.getOffices.mockResolvedValue(mockOffices);

      const event: CaseAssignment = {
        documentType: 'ASSIGNMENT',
        caseId: '000-11-22222',
        userId: 'user1',
        name: 'Test User',
        role: 'ATTORNEY',
        assignedOn: '2024-03-20T00:00:00Z',
        updatedOn: '2024-03-20T00:00:00Z',
        updatedBy: { id: 'system', name: 'System' },
      };

      // Execute
      await OfficeAssigneesUseCase.handleCaseAssignmentEvent(mockContext, event);

      // Verify
      expect(mockRepo.create).toHaveBeenCalledWith({
        officeCode: 'TEST',
        caseId: '000-11-22222',
        userId: 'user1',
        name: 'Test User',
      });
      expect(mockRepo.deleteMany).not.toHaveBeenCalled();
    });

    it('should delete a case assignment when unassignedOn is provided', async () => {
      // Setup
      const mockOffices: UstpOfficeDetails[] = [
        {
          officeCode: 'TEST',
          officeName: 'Test Office',
          groups: [
            {
              groupDesignator: 'TEST',
              divisions: [
                {
                  divisionCode: '000',
                  court: { courtId: 'TEST' },
                  courtOffice: { courtOfficeCode: 'TEST', courtOfficeName: 'Test Office' },
                },
              ],
            },
          ],
          idpGroupName: 'Test Group',
          regionId: 'TEST',
          regionName: 'Test Region',
        },
      ];
      mockGateway.getOffices.mockResolvedValue(mockOffices);

      const event: CaseAssignment = {
        documentType: 'ASSIGNMENT',
        caseId: '000-11-22222',
        userId: 'user1',
        name: 'Test User',
        role: 'ATTORNEY',
        assignedOn: '2024-03-20T00:00:00Z',
        unassignedOn: '2024-03-20T00:00:00Z',
        updatedOn: '2024-03-20T00:00:00Z',
        updatedBy: { id: 'system', name: 'System' },
      };

      // Execute
      await OfficeAssigneesUseCase.handleCaseAssignmentEvent(mockContext, event);

      // Verify
      expect(mockRepo.deleteMany).toHaveBeenCalledWith({
        caseId: '000-11-22222',
        userId: 'user1',
      });
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should throw an error when office mapping fails', async () => {
      // Setup
      const mockOffices: UstpOfficeDetails[] = [
        {
          officeCode: 'TEST',
          officeName: 'Test Office',
          groups: [
            {
              groupDesignator: 'TEST',
              divisions: [
                {
                  divisionCode: '999',
                  court: { courtId: 'TEST' },
                  courtOffice: { courtOfficeCode: 'TEST', courtOfficeName: 'Test Office' },
                },
              ],
            },
          ],
          idpGroupName: 'Test Group',
          regionId: 'TEST',
          regionName: 'Test Region',
        },
      ];
      mockGateway.getOffices.mockResolvedValue(mockOffices);

      const event: CaseAssignment = {
        documentType: 'ASSIGNMENT',
        caseId: '000-11-22222',
        userId: 'user1',
        name: 'Test User',
        role: 'ATTORNEY',
        assignedOn: '2024-03-20T00:00:00Z',
        updatedOn: '2024-03-20T00:00:00Z',
        updatedBy: { id: 'system', name: 'System' },
      };

      // Execute and Verify
      await expect(
        OfficeAssigneesUseCase.handleCaseAssignmentEvent(mockContext, event),
      ).rejects.toThrow();
    });
  });

  describe('handleCaseClosedEvent', () => {
    it('should delete all assignments for a closed case', async () => {
      // Setup
      const event = {
        caseId: '000-11-22222',
      };

      // Execute
      await OfficeAssigneesUseCase.handleCaseClosedEvent(mockContext, event);

      // Verify
      expect(mockRepo.deleteMany).toHaveBeenCalledWith({
        caseId: '000-11-22222',
      });
    });

    it('should throw an error when deletion fails', async () => {
      // Setup
      const event = {
        caseId: '000-11-22222',
      };
      (mockRepo.deleteMany as jest.Mock).mockRejectedValue(new Error('Deletion failed'));

      // Execute and Verify
      await expect(
        OfficeAssigneesUseCase.handleCaseClosedEvent(mockContext, event),
      ).rejects.toThrow();
    });
  });
});
