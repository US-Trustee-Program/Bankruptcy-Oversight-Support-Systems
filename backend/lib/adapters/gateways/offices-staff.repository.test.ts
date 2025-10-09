import { OfficesStaffRepository } from './offices-staff.repository';
import { ApplicationContext } from '../types/basic';
import { CamsRole } from '../../../../common/src/cams/roles';
import { getOfficesRepository } from '../../factory';
import { OfficesRepository } from '../../use-cases/gateways.types';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { OfficeStaff } from './mongo/offices.mongo.repository';

jest.mock('../../factory');

const mockGetOfficesRepository = getOfficesRepository as jest.MockedFunction<
  typeof getOfficesRepository
>;

describe('OfficesStaffRepository', () => {
  let repository: OfficesStaffRepository;
  let mockContext: ApplicationContext;
  let mockOfficesRepository: jest.Mocked<OfficesRepository>;

  beforeEach(async () => {
    repository = new OfficesStaffRepository();
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

  test('should return unique attorneys from repository search', async () => {
    // Mock repository search returning duplicate attorneys
    const mockStaff1: OfficeStaff = {
      id: 'attorney-1',
      name: 'John Attorney',
      roles: [CamsRole.TrialAttorney],
      documentType: 'OFFICE_STAFF',
      officeCode: 'OFFICE1',
      ttl: 3600,
      updatedOn: new Date().toISOString(),
      updatedBy: { id: 'test-user', name: 'Test User' },
    };
    const mockStaff2: OfficeStaff = {
      id: 'attorney-2',
      name: 'Jane Attorney',
      roles: [CamsRole.TrialAttorney],
      documentType: 'OFFICE_STAFF',
      officeCode: 'OFFICE2',
      ttl: 3600,
      updatedOn: new Date().toISOString(),
      updatedBy: { id: 'test-user', name: 'Test User' },
    };
    const duplicateStaff1: OfficeStaff = {
      id: 'attorney-1',
      name: 'John Attorney',
      roles: [CamsRole.TrialAttorney],
      documentType: 'OFFICE_STAFF',
      officeCode: 'OFFICE3',
      ttl: 3600,
      updatedOn: new Date().toISOString(),
      updatedBy: { id: 'test-user', name: 'Test User' },
    };

    mockOfficesRepository.search.mockResolvedValue([
      mockStaff1,
      mockStaff2,
      duplicateStaff1, // Duplicate with same id
    ]);

    const result = await repository.getAttorneyStaff(mockContext);

    // Verify deduplication works correctly
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { id: 'attorney-1', name: 'John Attorney' },
      { id: 'attorney-2', name: 'Jane Attorney' },
    ]);
    expect(mockOfficesRepository.search).toHaveBeenCalledWith({ role: CamsRole.TrialAttorney });
  });

  test('should return empty array when no attorneys found', async () => {
    // Mock repository search returning empty results
    mockOfficesRepository.search.mockResolvedValue([]);

    const result = await repository.getAttorneyStaff(mockContext);

    // Verify empty array returned
    expect(result).toHaveLength(0);
    expect(mockOfficesRepository.search).toHaveBeenCalledWith({ role: CamsRole.TrialAttorney });
  });

  test('should handle repository errors', async () => {
    const mockError = new Error('Repository error');
    mockOfficesRepository.search.mockRejectedValue(mockError);

    await expect(repository.getAttorneyStaff(mockContext)).rejects.toThrow('Repository error');
  });
});
