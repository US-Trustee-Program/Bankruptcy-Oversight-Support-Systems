import { vi } from 'vitest';
import { StaffMongoRepository } from './staff.mongo.repository';
import { ApplicationContext } from '../../types/basic';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { getOfficesRepository } from '../../../factory';
import { OfficesRepository } from '../../../use-cases/gateways.types';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { OfficeStaff } from './offices.mongo.repository';

vi.mock('../../../factory');

const mockGetOfficesRepository = getOfficesRepository as vi.MockedFunction<
  typeof getOfficesRepository
>;

describe('StaffMongoRepository', () => {
  let repository: StaffMongoRepository;
  let mockContext: ApplicationContext;
  let mockOfficesRepository: vi.Mocked<OfficesRepository>;

  beforeEach(async () => {
    const context = await createMockApplicationContext();
    repository = new StaffMongoRepository(context);
    mockContext = await createMockApplicationContext();

    mockOfficesRepository = {
      search: vi.fn(),
      putOrExtendOfficeStaff: vi.fn(),
      getOfficeAttorneys: vi.fn(),
      putOfficeStaff: vi.fn(),
      findAndDeleteStaff: vi.fn(),
      release: vi.fn(),
    } as vi.Mocked<OfficesRepository>;
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

    const mockParalegal1: OfficeStaff = {
      id: 'paralegal-1',
      name: 'Charlie Paralegal',
      roles: [CamsRole.Paralegal],
      documentType: 'OFFICE_STAFF',
      officeCode: 'OFFICE1',
      ttl: 3600,
      updatedOn: new Date().toISOString(),
      updatedBy: { id: 'test-user', name: 'Test User' },
    };

    // Mock search to return different results for each role
    mockOfficesRepository.search
      .mockResolvedValueOnce([mockAttorney1, mockAttorney2]) // TrialAttorney
      .mockResolvedValueOnce([mockAuditor1, duplicateStaff]) // Auditor
      .mockResolvedValueOnce([mockParalegal1]); // Paralegal

    const result = await repository.getOversightStaff(mockContext);

    // Verify deduplication works across roles
    expect(result).toHaveLength(4);
    expect(result).toEqual(
      expect.arrayContaining([
        { id: 'attorney-1', name: 'John Attorney', roles: [CamsRole.TrialAttorney] },
        { id: 'attorney-2', name: 'Jane Attorney', roles: [CamsRole.TrialAttorney] },
        { id: 'auditor-1', name: 'Bob Auditor', roles: [CamsRole.Auditor] },
        { id: 'paralegal-1', name: 'Charlie Paralegal', roles: [CamsRole.Paralegal] },
      ]),
    );

    // Verify roles field is included in the response
    const attorney = result.find((s) => s.id === 'attorney-1');
    const auditor = result.find((s) => s.id === 'auditor-1');
    const paralegal = result.find((s) => s.id === 'paralegal-1');

    expect(attorney?.roles).toBeDefined();
    expect(attorney?.roles).toContain(CamsRole.TrialAttorney);
    expect(auditor?.roles).toContain(CamsRole.Auditor);
    expect(paralegal?.roles).toContain(CamsRole.Paralegal);

    // Verify repository was called for each oversight role
    expect(mockOfficesRepository.search).toHaveBeenCalledTimes(3);
    expect(mockOfficesRepository.search).toHaveBeenCalledWith({ role: CamsRole.TrialAttorney });
    expect(mockOfficesRepository.search).toHaveBeenCalledWith({ role: CamsRole.Auditor });
    expect(mockOfficesRepository.search).toHaveBeenCalledWith({ role: CamsRole.Paralegal });
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
    expect(mockOfficesRepository.search).toHaveBeenCalledWith({ role: CamsRole.Paralegal });
  });

  test('should handle repository errors', async () => {
    const mockError = new Error('Repository error');
    mockOfficesRepository.search.mockRejectedValue(mockError);

    await expect(repository.getOversightStaff(mockContext)).rejects.toThrow('Repository error');
  });
});
