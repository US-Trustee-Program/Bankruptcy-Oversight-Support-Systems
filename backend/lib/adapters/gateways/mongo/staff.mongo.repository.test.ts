import { StaffMongoRepository } from './staff.mongo.repository';
import { ApplicationContext } from '../../types/basic';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { getOfficesRepository } from '../../../factory';
import { OfficesRepository } from '../../../use-cases/gateways.types';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { OfficeStaff } from './offices.mongo.repository';

jest.mock('../../../factory');

const mockGetOfficesRepository = getOfficesRepository as jest.MockedFunction<
  typeof getOfficesRepository
>;

describe('StaffMongoRepository', () => {
  let repository: StaffMongoRepository;
  let mockContext: ApplicationContext;
  let mockOfficesRepository: jest.Mocked<OfficesRepository>;

  beforeEach(async () => {
    const context = await createMockApplicationContext();
    repository = new StaffMongoRepository(context);
    mockContext = await createMockApplicationContext();

    mockOfficesRepository = {
      search: jest.fn(),
      putOrExtendOfficeStaff: jest.fn(),
      getOfficeAttorneys: jest.fn(),
      putOfficeStaff: jest.fn(),
      findAndDeleteStaff: jest.fn(),
      release: jest.fn(),
    } as jest.Mocked<OfficesRepository>;
    mockGetOfficesRepository.mockReturnValue(mockOfficesRepository);
  });

  test('should return unique staff from all oversight roles', async () => {
    // Mock staff data for different oversight roles
    const mockAttorney1: OfficeStaff = {
      id: 'attorney-1',
      name: 'John Attorney',
      roles: [CamsRole.TrialAttorney],
      documentType: 'OFFICE_STAFF',
      officeCode: 'OFFICE1',
      ttl: 3600,
      updatedOn: new Date().toISOString(),
      updatedBy: { id: 'test-user', name: 'Test User' },
    };
    const mockAttorney2: OfficeStaff = {
      id: 'attorney-2',
      name: 'Jane Attorney',
      roles: [CamsRole.TrialAttorney],
      documentType: 'OFFICE_STAFF',
      officeCode: 'OFFICE2',
      ttl: 3600,
      updatedOn: new Date().toISOString(),
      updatedBy: { id: 'test-user', name: 'Test User' },
    };
    const mockAuditor1: OfficeStaff = {
      id: 'auditor-1',
      name: 'Bob Auditor',
      roles: [CamsRole.Auditor],
      documentType: 'OFFICE_STAFF',
      officeCode: 'OFFICE1',
      ttl: 3600,
      updatedOn: new Date().toISOString(),
      updatedBy: { id: 'test-user', name: 'Test User' },
    };
    // Duplicate staff member with attorney ID appearing in auditor results
    const duplicateStaff: OfficeStaff = {
      id: 'attorney-1',
      name: 'John Attorney',
      roles: [CamsRole.Auditor],
      documentType: 'OFFICE_STAFF',
      officeCode: 'OFFICE3',
      ttl: 3600,
      updatedOn: new Date().toISOString(),
      updatedBy: { id: 'test-user', name: 'Test User' },
    };

    // Mock search to return different results for each role
    mockOfficesRepository.search
      .mockResolvedValueOnce([mockAttorney1, mockAttorney2]) // TrialAttorney
      .mockResolvedValueOnce([mockAuditor1, duplicateStaff]); // Auditor

    const result = await repository.getOversightStaff(mockContext);

    // Verify deduplication works across roles
    expect(result).toHaveLength(3);
    expect(result).toEqual([
      { id: 'attorney-1', name: 'John Attorney', roles: [CamsRole.TrialAttorney] },
      { id: 'attorney-2', name: 'Jane Attorney', roles: [CamsRole.TrialAttorney] },
      { id: 'auditor-1', name: 'Bob Auditor', roles: [CamsRole.Auditor] },
    ]);

    // Verify roles field is included in the response
    expect(result[0].roles).toBeDefined();
    expect(result[0].roles).toContain(CamsRole.TrialAttorney);
    expect(result[2].roles).toContain(CamsRole.Auditor);

    // Verify repository was called for each oversight role
    expect(mockOfficesRepository.search).toHaveBeenCalledTimes(2);
    expect(mockOfficesRepository.search).toHaveBeenCalledWith({ role: CamsRole.TrialAttorney });
    expect(mockOfficesRepository.search).toHaveBeenCalledWith({ role: CamsRole.Auditor });
  });

  test('should return empty array when no staff found', async () => {
    // Mock repository search returning empty results for all roles
    mockOfficesRepository.search.mockResolvedValue([]);

    const result = await repository.getOversightStaff(mockContext);

    // Verify empty array returned
    expect(result).toHaveLength(0);
    // Verify repository was called for each oversight role
    expect(mockOfficesRepository.search).toHaveBeenCalledWith({ role: CamsRole.TrialAttorney });
    expect(mockOfficesRepository.search).toHaveBeenCalledWith({ role: CamsRole.Auditor });
  });

  test('should handle repository errors', async () => {
    const mockError = new Error('Repository error');
    mockOfficesRepository.search.mockRejectedValue(mockError);

    await expect(repository.getOversightStaff(mockContext)).rejects.toThrow('Repository error');
  });
});
