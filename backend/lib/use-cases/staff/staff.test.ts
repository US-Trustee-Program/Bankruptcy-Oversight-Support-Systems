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

    // Create a mock staff repository
    mockStaffRepository = {
      getAttorneyStaff: jest.fn(),
    };

    // Mock the factory function to return our mock repository
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
      // Arrange
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

      // Act
      const result = await staffUseCase.getAttorneyList(mockApplicationContext);

      // Assert
      expect(mockStaffRepository.getAttorneyStaff).toHaveBeenCalledWith(mockApplicationContext);
      expect(result).toEqual(expectedStaff);
    });

    test('should return empty array when no attorney staff found', async () => {
      // Arrange
      mockStaffRepository.getAttorneyStaff.mockResolvedValue([]);

      // Act
      const result = await staffUseCase.getAttorneyList(mockApplicationContext);

      // Assert
      expect(mockStaffRepository.getAttorneyStaff).toHaveBeenCalledWith(mockApplicationContext);
      expect(result).toEqual([]);
    });

    test('should handle repository errors gracefully', async () => {
      // Arrange
      const expectedError = new Error('Database connection failed');
      mockStaffRepository.getAttorneyStaff.mockRejectedValue(expectedError);

      // Act & Assert
      await expect(staffUseCase.getAttorneyList(mockApplicationContext)).rejects.toThrow(
        'Database connection failed',
      );
      expect(mockStaffRepository.getAttorneyStaff).toHaveBeenCalledWith(mockApplicationContext);
    });

    test('should handle different application context in method call', async () => {
      // Arrange
      const differentContext = await createMockApplicationContext();
      const expectedStaff: Staff[] = [
        {
          id: '3',
          name: 'Bob Johnson',
          roles: [CamsRole.TrialAttorney],
        },
      ];

      mockStaffRepository.getAttorneyStaff.mockResolvedValue(expectedStaff);

      // Act
      const result = await staffUseCase.getAttorneyList(differentContext);

      // Assert
      expect(mockStaffRepository.getAttorneyStaff).toHaveBeenCalledWith(differentContext);
      expect(result).toEqual(expectedStaff);
    });

    test('should handle repository timeout errors', async () => {
      // Arrange
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockStaffRepository.getAttorneyStaff.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(staffUseCase.getAttorneyList(mockApplicationContext)).rejects.toThrow(
        'Request timeout',
      );
    });

    test('should handle large staff arrays', async () => {
      // Arrange - Create a large array of staff
      const largeStaffArray: Staff[] = Array.from({ length: 1000 }, (_, index) => ({
        id: `${index + 1}`,
        name: `Attorney ${index + 1}`,
        email: `attorney${index + 1}@example.com`,
        role: 'Attorney',
      }));

      mockStaffRepository.getAttorneyStaff.mockResolvedValue(largeStaffArray);

      // Act
      const result = await staffUseCase.getAttorneyList(mockApplicationContext);

      // Assert
      expect(result).toHaveLength(1000);
      expect(result[0].name).toBe('Attorney 1');
      expect(result[999].name).toBe('Attorney 1000');
    });
  });

  describe('edge cases', () => {
    test('should handle multiple concurrent calls', async () => {
      // Arrange
      const staffList: Staff[] = [
        {
          id: '1',
          name: 'Concurrent Test',
          roles: [CamsRole.TrialAttorney],
        },
      ];

      mockStaffRepository.getAttorneyStaff.mockResolvedValue(staffList);

      // Act - Make multiple concurrent calls
      const promises = [
        staffUseCase.getAttorneyList(mockApplicationContext),
        staffUseCase.getAttorneyList(mockApplicationContext),
        staffUseCase.getAttorneyList(mockApplicationContext),
      ];

      const results = await Promise.all(promises);

      // Assert
      expect(mockStaffRepository.getAttorneyStaff).toHaveBeenCalledTimes(3);
      results.forEach((result) => {
        expect(result).toEqual(staffList);
      });
    });

    test('should maintain repository instance across multiple method calls', () => {
      // Arrange & Act
      const firstRepository = staffUseCase.staffRepository;
      const secondRepository = staffUseCase.staffRepository;

      // Assert
      expect(firstRepository).toBe(secondRepository);
      expect(firstRepository).toBe(mockStaffRepository);
    });
  });
});
