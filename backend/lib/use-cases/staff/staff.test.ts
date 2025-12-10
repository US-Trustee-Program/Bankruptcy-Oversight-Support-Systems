import { vi } from 'vitest';
import StaffUseCase from './staff';
import { ApplicationContext } from '../../adapters/types/basic';
import { StaffRepository } from '../gateways.types';
import { Staff } from '../../../../common/src/cams/users';
import { getStaffRepository } from '../../factory';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CamsRole } from '../../../../common/src/cams/roles';

vi.mock('../../factory');

describe('StaffUseCase', () => {
  let mockApplicationContext: ApplicationContext;
  let mockStaffRepository: vi.Mocked<StaffRepository>;
  let staffUseCase: StaffUseCase;

  beforeEach(async () => {
    mockApplicationContext = await createMockApplicationContext();

    mockStaffRepository = {
      getOversightStaff: vi.fn(),
    };

    (getStaffRepository as vi.Mock).mockReturnValue(mockStaffRepository);

    staffUseCase = new StaffUseCase(mockApplicationContext);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize staffRepository through factory', () => {
      expect(getStaffRepository).toHaveBeenCalledWith(mockApplicationContext);
      expect(staffUseCase.staffRepository).toBe(mockStaffRepository);
    });

    test('should create instance with different application context', async () => {
      const anotherContext = await createMockApplicationContext();
      const anotherStaffUseCase = new StaffUseCase(anotherContext);

      expect(getStaffRepository).toHaveBeenCalledWith(anotherContext);
      expect(anotherStaffUseCase.staffRepository).toBe(mockStaffRepository);
    });
  });

  describe('getOversightStaff', () => {
    test('should return oversight staff list with multiple roles successfully', async () => {
      const expectedStaff: Staff[] = [
        {
          id: '1',
          name: 'John Doe',
          roles: [CamsRole.TrialAttorney],
        },
        {
          id: '2',
          name: 'Jane Smith',
          roles: [CamsRole.Auditor],
        },
        {
          id: '3',
          name: 'Bob Johnson',
          roles: [CamsRole.TrialAttorney, CamsRole.Auditor],
        },
      ];

      mockStaffRepository.getOversightStaff.mockResolvedValue(expectedStaff);

      const result = await staffUseCase.getOversightStaff(mockApplicationContext);

      expect(mockStaffRepository.getOversightStaff).toHaveBeenCalledWith(mockApplicationContext);
      expect(result).toEqual(expectedStaff);
    });

    test('should return empty array when no staff found', async () => {
      mockStaffRepository.getOversightStaff.mockResolvedValue([]);

      const result = await staffUseCase.getOversightStaff(mockApplicationContext);

      expect(mockStaffRepository.getOversightStaff).toHaveBeenCalledWith(mockApplicationContext);
      expect(result).toEqual([]);
    });

    test('should handle repository errors gracefully', async () => {
      const expectedError = new Error('Database connection failed');
      mockStaffRepository.getOversightStaff.mockRejectedValue(expectedError);

      await expect(staffUseCase.getOversightStaff(mockApplicationContext)).rejects.toThrow(
        'Database connection failed',
      );
      expect(mockStaffRepository.getOversightStaff).toHaveBeenCalledWith(mockApplicationContext);
    });
  });
});
