import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAssignmentsUseCase } from './trustee-assignments';
import { TrusteesRepository } from '../gateways.types';
import { TrusteeOversightAssignment } from '../../../../common/src/cams/trustees';
import { OversightRole } from '../../../../common/src/cams/roles';
import { BadRequestError } from '../../common-errors/bad-request';
import { CamsError } from '../../common-errors/cams-error';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CamsUserReference } from '../../../../common/src/cams/users';
import { UserGroupGateway } from '../../adapters/types/authorization';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import * as factory from '../../factory';
import * as errorUtilities from '../../common-errors/error-utilities';

// Mock the factory functions
jest.mock('../../factory');
const mockFactory = factory as jest.Mocked<typeof factory>;

// Mock the error utilities
jest.mock('../../common-errors/error-utilities');
const mockErrorUtilities = errorUtilities as jest.Mocked<typeof errorUtilities>;

describe('TrusteeAssignmentsUseCase', () => {
  let useCase: TrusteeAssignmentsUseCase;
  let context: ApplicationContext;
  let mockTrusteesRepository: jest.Mocked<TrusteesRepository>;
  let mockUserGroupGateway: jest.Mocked<UserGroupGateway>;

  const mockUser: CamsUserReference = {
    id: 'user-123',
    name: 'Test User',
  };

  const mockAttorney: CamsUserReference = {
    id: 'attorney-456',
    name: 'Attorney Smith',
  };

  const mockAssignment: TrusteeOversightAssignment = {
    id: 'assignment-123',
    trusteeId: 'trustee-789',
    user: mockAttorney,
    role: OversightRole.OversightAttorney,
    createdBy: mockUser,
    createdOn: '2023-01-01T00:00:00.000Z',
    updatedBy: mockUser,
    updatedOn: '2023-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    context = await createMockApplicationContext();
    context.session.user = mockUser;

    // Mock logger methods
    context.logger.info = jest.fn();
    context.logger.error = jest.fn();

    mockTrusteesRepository = {
      getTrusteeOversightAssignments: jest.fn(),
      createTrusteeOversightAssignment: jest.fn(),
      createTrusteeHistory: jest.fn(),
      read: jest.fn(),
      release: jest.fn(),
      createTrustee: jest.fn(),
      listTrusteeHistory: jest.fn(),
      listTrustees: jest.fn(),
      updateTrustee: jest.fn(),
    };

    mockUserGroupGateway = {
      init: jest.fn(),
      getUserGroupWithUsers: jest.fn(),
      getUserById: jest.fn(),
      getUsers: jest.fn(),
      getUserGroups: jest.fn(),
      getUserGroupUsers: jest.fn(),
      release: jest.fn(),
    } as jest.Mocked<UserGroupGateway>;

    mockFactory.getTrusteesRepository.mockReturnValue(mockTrusteesRepository);
    mockFactory.getUserGroupGateway.mockResolvedValue(mockUserGroupGateway);
    mockErrorUtilities.getCamsError.mockImplementation((error) => error);

    useCase = new TrusteeAssignmentsUseCase(context);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTrusteeOversightAssignments', () => {
    describe('validation', () => {
      test('should throw BadRequestError when trusteeId is null', async () => {
        await expect(
          useCase.getTrusteeOversightAssignments(context, null as never),
        ).rejects.toThrow(BadRequestError);
      });

      test('should throw BadRequestError when trusteeId is undefined', async () => {
        await expect(
          useCase.getTrusteeOversightAssignments(context, undefined as never),
        ).rejects.toThrow(BadRequestError);
      });

      test('should throw BadRequestError when trusteeId is empty string', async () => {
        await expect(useCase.getTrusteeOversightAssignments(context, '')).rejects.toThrow(
          BadRequestError,
        );
      });

      test('should throw BadRequestError when trusteeId is whitespace only', async () => {
        await expect(useCase.getTrusteeOversightAssignments(context, '   ')).rejects.toThrow(
          BadRequestError,
        );
      });
    });

    describe('successful retrieval', () => {
      test('should return assignments when trusteeId is valid', async () => {
        const assignments = [mockAssignment];
        mockTrusteesRepository.getTrusteeOversightAssignments.mockResolvedValue(assignments);

        const result = await useCase.getTrusteeOversightAssignments(context, 'trustee-789');

        expect(mockTrusteesRepository.getTrusteeOversightAssignments).toHaveBeenCalledWith(
          'trustee-789',
        );
        expect(result).toEqual(assignments);
        expect(context.logger.info).toHaveBeenCalledWith(
          'TRUSTEE-ASSIGNMENTS-USE-CASE',
          'Retrieved 1 oversight assignments for trustee trustee-789',
        );
      });

      test('should return empty array when no assignments exist', async () => {
        mockTrusteesRepository.getTrusteeOversightAssignments.mockResolvedValue([]);

        const result = await useCase.getTrusteeOversightAssignments(context, 'trustee-789');

        expect(result).toEqual([]);
        expect(context.logger.info).toHaveBeenCalledWith(
          'TRUSTEE-ASSIGNMENTS-USE-CASE',
          'Retrieved 0 oversight assignments for trustee trustee-789',
        );
      });
    });

    describe('error handling', () => {
      test('should re-throw BadRequestError from repository', async () => {
        const badRequestError = new BadRequestError('TEST-MODULE', { message: 'Bad request' });
        mockTrusteesRepository.getTrusteeOversightAssignments.mockRejectedValue(badRequestError);

        await expect(
          useCase.getTrusteeOversightAssignments(context, 'trustee-789'),
        ).rejects.toThrow(BadRequestError);
      });

      test('should wrap other errors in CamsError', async () => {
        const genericError = new Error('Database error');
        mockTrusteesRepository.getTrusteeOversightAssignments.mockRejectedValue(genericError);

        mockErrorUtilities.getCamsError.mockReturnValue(
          new CamsError('TRUSTEE-ASSIGNMENTS-USE-CASE', { message: 'Wrapped error' }),
        );

        await expect(
          useCase.getTrusteeOversightAssignments(context, 'trustee-789'),
        ).rejects.toThrow(CamsError);

        expect(mockErrorUtilities.getCamsError).toHaveBeenCalledWith(
          genericError,
          'TRUSTEE-ASSIGNMENTS-USE-CASE',
        );
        expect(context.logger.error).toHaveBeenCalledWith(
          'TRUSTEE-ASSIGNMENTS-USE-CASE',
          'Failed to retrieve oversight assignments for trustee trustee-789.',
          genericError,
        );
      });
    });
  });

  describe('assignAttorneyToTrustee', () => {
    describe('validation', () => {
      test('should throw BadRequestError when trusteeId is empty', async () => {
        await expect(useCase.assignAttorneyToTrustee(context, '', 'attorney-456')).rejects.toThrow(
          BadRequestError,
        );
        expect(mockTrusteesRepository.getTrusteeOversightAssignments).not.toHaveBeenCalled();
      });

      test('should throw BadRequestError when trusteeId is whitespace only', async () => {
        await expect(
          useCase.assignAttorneyToTrustee(context, '   ', 'attorney-456'),
        ).rejects.toThrow(BadRequestError);
      });

      test('should throw BadRequestError when attorneyUserId is empty', async () => {
        await expect(useCase.assignAttorneyToTrustee(context, 'trustee-789', '')).rejects.toThrow(
          BadRequestError,
        );
      });

      test('should throw BadRequestError when attorneyUserId is whitespace only', async () => {
        await expect(
          useCase.assignAttorneyToTrustee(context, 'trustee-789', '   '),
        ).rejects.toThrow(BadRequestError);
      });
    });

    describe('existing assignment handling', () => {
      test('should return existing assignment when same attorney is already assigned (idempotent)', async () => {
        const existingAssignment = {
          ...mockAssignment,
          user: { id: 'attorney-456', name: 'Attorney Smith' },
        };
        mockTrusteesRepository.getTrusteeOversightAssignments.mockResolvedValue([
          existingAssignment,
        ]);

        const result = await useCase.assignAttorneyToTrustee(
          context,
          'trustee-789',
          'attorney-456',
        );

        expect(result).toEqual(existingAssignment);
        expect(context.logger.info).toHaveBeenCalledWith(
          'TRUSTEE-ASSIGNMENTS-USE-CASE',
          'Attorney attorney-456 already assigned to trustee trustee-789',
        );
        expect(mockUserGroupGateway.getUserById).not.toHaveBeenCalled();
        expect(mockTrusteesRepository.createTrusteeOversightAssignment).not.toHaveBeenCalled();
      });

      test('should throw BadRequestError when different attorney is already assigned', async () => {
        const existingAssignment = {
          ...mockAssignment,
          user: { id: 'different-attorney', name: 'Different Attorney' },
        };
        mockTrusteesRepository.getTrusteeOversightAssignments.mockResolvedValue([
          existingAssignment,
        ]);

        // For this test, we want the original BadRequestError to be thrown, not wrapped
        mockErrorUtilities.getCamsError.mockImplementation((error) => error); // Pass through the original error

        await expect(
          useCase.assignAttorneyToTrustee(context, 'trustee-789', 'attorney-456'),
        ).rejects.toThrow(BadRequestError);

        expect(mockUserGroupGateway.getUserById).not.toHaveBeenCalled();
        expect(mockTrusteesRepository.createTrusteeOversightAssignment).not.toHaveBeenCalled();
      });

      test('should proceed with assignment when no existing attorney assignment exists', async () => {
        const nonAttorneyAssignment = {
          ...mockAssignment,
          role: 'SomeOtherRole' as never, // Not OversightAttorney
        };
        mockTrusteesRepository.getTrusteeOversightAssignments.mockResolvedValue([
          nonAttorneyAssignment,
        ]);
        mockUserGroupGateway.getUserById.mockResolvedValue(MockData.getCamsUser());
        mockTrusteesRepository.createTrusteeOversightAssignment.mockResolvedValue(mockAssignment);
        mockTrusteesRepository.createTrusteeHistory.mockResolvedValue();

        const result = await useCase.assignAttorneyToTrustee(
          context,
          'trustee-789',
          'attorney-456',
        );

        expect(result).toEqual(mockAssignment);
        expect(mockTrusteesRepository.createTrusteeOversightAssignment).toHaveBeenCalled();
      });
    });

    describe('successful assignment creation', () => {
      beforeEach(() => {
        mockTrusteesRepository.getTrusteeOversightAssignments.mockResolvedValue([]);
        mockUserGroupGateway.getUserById.mockResolvedValue(MockData.getCamsUser());
        mockTrusteesRepository.createTrusteeOversightAssignment.mockResolvedValue(mockAssignment);
        mockTrusteesRepository.createTrusteeHistory.mockResolvedValue();
      });

      test('should create new assignment when no existing attorney assignment', async () => {
        const result = await useCase.assignAttorneyToTrustee(
          context,
          'trustee-789',
          'attorney-456',
        );

        expect(mockTrusteesRepository.getTrusteeOversightAssignments).toHaveBeenCalledWith(
          'trustee-789',
        );
        expect(mockUserGroupGateway.getUserById).toHaveBeenCalledWith(context, 'attorney-456');
        expect(mockTrusteesRepository.createTrusteeOversightAssignment).toHaveBeenCalled();
        expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalled();
        expect(result).toEqual(mockAssignment);
      });

      test('should create audit record with correct structure', async () => {
        await useCase.assignAttorneyToTrustee(context, 'trustee-789', 'attorney-456');

        const createAssignmentCall =
          mockTrusteesRepository.createTrusteeOversightAssignment.mock.calls[0][0];
        expect(createAssignmentCall).toHaveProperty('trusteeId', 'trustee-789');
        expect(createAssignmentCall).toHaveProperty('role', OversightRole.OversightAttorney);
        expect(createAssignmentCall).toHaveProperty('createdBy');
        expect(createAssignmentCall).toHaveProperty('createdOn');
      });

      test('should create history record with correct structure', async () => {
        await useCase.assignAttorneyToTrustee(context, 'trustee-789', 'attorney-456');

        const createHistoryCall = mockTrusteesRepository.createTrusteeHistory.mock.calls[0][0];
        expect(createHistoryCall).toHaveProperty('documentType', 'AUDIT_OVERSIGHT');
        expect(createHistoryCall).toHaveProperty('trusteeId', 'trustee-789');
        expect(createHistoryCall).toHaveProperty('before', null);
        expect(createHistoryCall.after).toHaveProperty('role', OversightRole.OversightAttorney);
      });
    });

    describe('error handling', () => {
      test('should wrap errors from getUserById', async () => {
        mockTrusteesRepository.getTrusteeOversightAssignments.mockResolvedValue([]);
        const getUserError = new Error('User not found');
        mockUserGroupGateway.getUserById.mockRejectedValue(getUserError);

        mockErrorUtilities.getCamsError.mockReturnValue(
          new CamsError('TRUSTEE-ASSIGNMENTS-USE-CASE', { message: 'Wrapped error' }),
        );

        await expect(
          useCase.assignAttorneyToTrustee(context, 'trustee-789', 'attorney-456'),
        ).rejects.toThrow(CamsError);

        expect(mockErrorUtilities.getCamsError).toHaveBeenCalledWith(
          getUserError,
          'TRUSTEE-ASSIGNMENTS-USE-CASE',
        );
      });

      test('should wrap errors from createTrusteeOversightAssignment', async () => {
        mockTrusteesRepository.getTrusteeOversightAssignments.mockResolvedValue([]);
        mockUserGroupGateway.getUserById.mockResolvedValue(MockData.getCamsUser());
        const createError = new Error('Database error');
        mockTrusteesRepository.createTrusteeOversightAssignment.mockRejectedValue(createError);

        mockErrorUtilities.getCamsError.mockReturnValue(
          new CamsError('TRUSTEE-ASSIGNMENTS-USE-CASE', { message: 'Wrapped error' }),
        );

        await expect(
          useCase.assignAttorneyToTrustee(context, 'trustee-789', 'attorney-456'),
        ).rejects.toThrow(CamsError);

        expect(mockErrorUtilities.getCamsError).toHaveBeenCalledWith(
          createError,
          'TRUSTEE-ASSIGNMENTS-USE-CASE',
        );
      });

      test('should wrap errors from createTrusteeHistory', async () => {
        mockTrusteesRepository.getTrusteeOversightAssignments.mockResolvedValue([]);
        mockUserGroupGateway.getUserById.mockResolvedValue(MockData.getCamsUser());
        mockTrusteesRepository.createTrusteeOversightAssignment.mockResolvedValue(mockAssignment);
        const historyError = new Error('History creation failed');
        mockTrusteesRepository.createTrusteeHistory.mockRejectedValue(historyError);

        mockErrorUtilities.getCamsError.mockReturnValue(
          new CamsError('TRUSTEE-ASSIGNMENTS-USE-CASE', { message: 'Wrapped error' }),
        );

        await expect(
          useCase.assignAttorneyToTrustee(context, 'trustee-789', 'attorney-456'),
        ).rejects.toThrow(CamsError);

        expect(mockErrorUtilities.getCamsError).toHaveBeenCalledWith(
          historyError,
          'TRUSTEE-ASSIGNMENTS-USE-CASE',
        );
      });

      test('should wrap errors from getTrusteeOversightAssignments', async () => {
        const getAssignmentsError = new Error('Cannot retrieve assignments');
        mockTrusteesRepository.getTrusteeOversightAssignments.mockRejectedValue(
          getAssignmentsError,
        );

        mockErrorUtilities.getCamsError.mockReturnValue(
          new CamsError('TRUSTEE-ASSIGNMENTS-USE-CASE', { message: 'Wrapped error' }),
        );

        await expect(
          useCase.assignAttorneyToTrustee(context, 'trustee-789', 'attorney-456'),
        ).rejects.toThrow(CamsError);

        expect(mockErrorUtilities.getCamsError).toHaveBeenCalledWith(
          getAssignmentsError,
          'TRUSTEE-ASSIGNMENTS-USE-CASE',
        );
      });
    });
  });
});
