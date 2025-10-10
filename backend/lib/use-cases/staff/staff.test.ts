import StaffUseCase from './staff';
import { ApplicationContext } from '../../adapters/types/basic';
import { StaffRepository } from '../gateways.types';
import { Staff } from '../../../../common/src/cams/users';
import { getStaffRepository } from '../../factory';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CamsRole } from '../../../../common/src/cams/roles';

jest.mock('../../factory');

describe('StaffUseCase', () => {
  let mockApplicationContext: ApplicationContext;
  let mockStaffRepository: jest.Mocked<StaffRepository>;
  let staffUseCase: StaffUseCase;

  beforeEach(async () => {
    mockApplicationContext = await createMockApplicationContext();

    mockStaffRepository = {
      getAttorneyStaff: jest.fn(),
    };

    (getStaffRepository as jest.Mock).mockReturnValue(mockStaffRepository);

    staffUseCase = new StaffUseCase(mockApplicationContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
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

  describe('getAttorneyList', () => {
    test('should return attorney staff list successfully', async () => {
      const expectedStaff: Staff[] = [
        {
          id: '1',
          name: 'John Doe',
          roles: [CamsRole.TrialAttorney],
        },
        {
          id: '2',
          name: 'Jane Smith',
          roles: [CamsRole.TrialAttorney],
        },
      ];

      mockStaffRepository.getAttorneyStaff.mockResolvedValue(expectedStaff);

      const result = await staffUseCase.getAttorneyList(mockApplicationContext);

      expect(mockStaffRepository.getAttorneyStaff).toHaveBeenCalledWith(mockApplicationContext);
      expect(result).toEqual(expectedStaff);
    });

    test('should return empty array when no attorney staff found', async () => {
      mockStaffRepository.getAttorneyStaff.mockResolvedValue([]);

      const result = await staffUseCase.getAttorneyList(mockApplicationContext);

      expect(mockStaffRepository.getAttorneyStaff).toHaveBeenCalledWith(mockApplicationContext);
      expect(result).toEqual([]);
    });

    test('should handle repository errors gracefully', async () => {
      const expectedError = new Error('Database connection failed');
      mockStaffRepository.getAttorneyStaff.mockRejectedValue(expectedError);

      // Act & Assert
      await expect(staffUseCase.getAttorneyList(mockApplicationContext)).rejects.toThrow(
        'Database connection failed',
      );
      expect(mockStaffRepository.getAttorneyStaff).toHaveBeenCalledWith(mockApplicationContext);
    });
  });
});
