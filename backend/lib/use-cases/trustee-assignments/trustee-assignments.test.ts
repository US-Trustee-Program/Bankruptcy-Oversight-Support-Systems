import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAssignmentsUseCase } from './trustee-assignments';
import { TrusteesRepository, UserGroupsRepository } from '../gateways.types';
import {
  TrusteeOversightAssignment,
  TrusteeOversightHistory,
} from '../../../../common/src/cams/trustees';
import { CamsRole, OversightRole } from '../../../../common/src/cams/roles';
import { BadRequestError } from '../../common-errors/bad-request';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { CamsError } from '../../common-errors/cams-error';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CamsUserReference } from '../../../../common/src/cams/users';
import { UserGroupGateway } from '../../adapters/types/authorization';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import * as factory from '../../factory';
import * as errorUtilities from '../../common-errors/error-utilities';

// Mock the factory functions
vi.mock('../../factory');
const mockFactory = factory as vi.Mocked<typeof factory>;

// Mock the error utilities
vi.mock('../../common-errors/error-utilities');
const mockErrorUtilities = errorUtilities as vi.Mocked<typeof errorUtilities>;

describe('TrusteeAssignmentsUseCase', () => {
  let useCase: TrusteeAssignmentsUseCase;
  let context: ApplicationContext;
  let mockTrusteesRepository: vi.Mocked<TrusteesRepository>;
  let mockUserGroupGateway: vi.Mocked<UserGroupGateway>;
  let mockUserGroupsRepository: vi.Mocked<UserGroupsRepository>;

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
    // Set TrusteeAdmin role by default for most tests
    context.session.user.roles = [CamsRole.TrusteeAdmin];

    // Mock logger methods
    context.logger.info = vi.fn();
    context.logger.error = vi.fn();

    mockTrusteesRepository = {
      getTrusteeOversightAssignments: vi.fn(),
      createTrusteeOversightAssignment: vi.fn(),
      createTrusteeHistory: vi.fn(),
      read: vi.fn(),
      release: vi.fn(),
      createTrustee: vi.fn(),
      listTrusteeHistory: vi.fn(),
      listTrustees: vi.fn(),
      updateTrustee: vi.fn(),
      updateTrusteeOversightAssignment: vi.fn(),
    };

    mockUserGroupGateway = {
      init: vi.fn(),
      getUserGroupWithUsers: vi.fn(),
      getUserById: vi.fn(),
      getUsers: vi.fn(),
      getUserGroups: vi.fn(),
      getUserGroupUsers: vi.fn(),
      release: vi.fn(),
    } as vi.Mocked<UserGroupGateway>;

    mockUserGroupsRepository = {
      upsertUserGroupsBatch: vi.fn(),
      read: vi.fn(),
      release: vi.fn(),
    } as vi.Mocked<UserGroupsRepository>;

    mockFactory.getTrusteesRepository.mockReturnValue(mockTrusteesRepository);
    mockFactory.getUserGroupGateway.mockResolvedValue(mockUserGroupGateway);
    mockFactory.getUserGroupsRepository.mockReturnValue(mockUserGroupsRepository);
    mockErrorUtilities.getCamsError.mockImplementation((error) => error as CamsError);

    useCase = new TrusteeAssignmentsUseCase(context);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getTrusteeOversightAssignments', () => {
    const validationTestCases = [
      ['null', null as never],
      ['undefined', undefined as never],
      ['empty string', ''],
      ['whitespace only', '   '],
    ] as const;

    describe('validation', () => {
      test.each(validationTestCases)(
        'should throw BadRequestError when trusteeId is %s',
        async (_description, trusteeId) => {
          await expect(useCase.getTrusteeOversightAssignments(context, trusteeId)).rejects.toThrow(
            BadRequestError,
          );
        },
      );
    });

    describe('successful retrieval', () => {
      const successfulRetrievalTestCases = [
        [
          'should return assignments when trusteeId is valid',
          [mockAssignment] as TrusteeOversightAssignment[],
          'Retrieved 1 oversight assignments for trustee trustee-789',
        ],
        [
          'should return empty array when no assignments exist',
          [] as TrusteeOversightAssignment[],
          'Retrieved 0 oversight assignments for trustee trustee-789',
        ],
      ] as const;

      test.each(successfulRetrievalTestCases)(
        '%s',
        async (_testDescription, assignments, expectedLogMessage) => {
          mockTrusteesRepository.getTrusteeOversightAssignments.mockResolvedValue(assignments);

          const result = await useCase.getTrusteeOversightAssignments(context, 'trustee-789');

          expect(mockTrusteesRepository.getTrusteeOversightAssignments).toHaveBeenCalledWith(
            'trustee-789',
          );
          expect(result).toEqual(assignments);
          expect(context.logger.info).toHaveBeenCalledWith(
            'TRUSTEE-ASSIGNMENTS-USE-CASE',
            expectedLogMessage,
          );
        },
      );
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

  describe('assignOversightStaffToTrustee', () => {
    describe('validation', () => {
      test('should throw UnauthorizedError when user does not have TrusteeAdmin role', async () => {
        // Modify context to not include TrusteeAdmin role
        context.session.user.roles = [CamsRole.TrialAttorney];

        await expect(
          useCase.assignOversightStaffToTrustee(
            context,
            'trustee-789',
            'attorney-456',
            OversightRole.OversightAttorney,
          ),
        ).rejects.toThrow(UnauthorizedError);

        // Verify no further processing occurs
        expect(mockTrusteesRepository.getTrusteeOversightAssignments).not.toHaveBeenCalled();
        expect(mockUserGroupGateway.getUserById).not.toHaveBeenCalled();
        expect(mockTrusteesRepository.createTrusteeOversightAssignment).not.toHaveBeenCalled();
      });

      const trusteeIdValidationTestCases = [
        ['trusteeId is empty', '', 'attorney-456'],
        ['trusteeId is whitespace only', '   ', 'attorney-456'],
      ] as const;

      const staffUserIdValidationTestCases = [
        ['staffUserId is empty', 'trustee-789', ''],
        ['staffUserId is whitespace only', 'trustee-789', '   '],
      ] as const;

      test.each(trusteeIdValidationTestCases)(
        'should throw BadRequestError when %s',
        async (_description, trusteeId, staffUserId) => {
          await expect(
            useCase.assignOversightStaffToTrustee(
              context,
              trusteeId,
              staffUserId,
              OversightRole.OversightAttorney,
            ),
          ).rejects.toThrow(BadRequestError);

          expect(mockTrusteesRepository.getTrusteeOversightAssignments).not.toHaveBeenCalled();
        },
      );

      test.each(staffUserIdValidationTestCases)(
        'should throw BadRequestError when %s',
        async (_description, trusteeId, staffUserId) => {
          await expect(
            useCase.assignOversightStaffToTrustee(
              context,
              trusteeId,
              staffUserId,
              OversightRole.OversightAttorney,
            ),
          ).rejects.toThrow(BadRequestError);
        },
      );

      test('should throw BadRequestError when role is not a valid OversightRole', async () => {
        await expect(
          useCase.assignOversightStaffToTrustee(
            context,
            'trustee-789',
            'staff-456',
            'InvalidRole' as never,
          ),
        ).rejects.toThrow(BadRequestError);

        expect(mockTrusteesRepository.getTrusteeOversightAssignments).not.toHaveBeenCalled();
      });
    });

    describe('existing assignment handling', () => {
      test('should return false when same staff with same role is already assigned (idempotent)', async () => {
        const existingAssignment = {
          ...mockAssignment,
          user: { id: 'attorney-456', name: 'Attorney Smith' },
          role: OversightRole.OversightAttorney,
        };
        mockTrusteesRepository.getTrusteeOversightAssignments.mockResolvedValue([
          existingAssignment,
        ]);

        const result = await useCase.assignOversightStaffToTrustee(
          context,
          'trustee-789',
          'attorney-456',
          OversightRole.OversightAttorney,
        );

        expect(result).toBe(false);
        expect(mockUserGroupGateway.getUserById).not.toHaveBeenCalled();
        expect(mockTrusteesRepository.createTrusteeOversightAssignment).not.toHaveBeenCalled();
      });

      test('should replace existing assignment when different staff member is assigned for the same role', async () => {
        const existingAssignment = {
          ...mockAssignment,
          id: 'existing-assignment-id',
          user: { id: 'different-attorney', name: 'Different Attorney' },
          role: OversightRole.OversightAttorney,
        } as TrusteeOversightAssignment;

        const newAssignee = MockData.getCamsUser();
        const newCreatedAssignment = {
          ...mockAssignment,
          id: 'new-assignment-id',
          user: mockAttorney,
          role: OversightRole.OversightAttorney,
        };

        mockTrusteesRepository.getTrusteeOversightAssignments.mockResolvedValue([
          existingAssignment,
        ]);

        mockTrusteesRepository.updateTrusteeOversightAssignment = vi.fn().mockResolvedValue({
          ...existingAssignment,
          unassignedOn: '2025-10-28T00:00:00.000Z',
        } as TrusteeOversightAssignment);

        mockUserGroupGateway.getUserById.mockResolvedValue(newAssignee);
        mockTrusteesRepository.createTrusteeOversightAssignment.mockResolvedValue(
          newCreatedAssignment as TrusteeOversightAssignment,
        );
        mockTrusteesRepository.createTrusteeHistory.mockResolvedValue();

        const result = await useCase.assignOversightStaffToTrustee(
          context,
          'trustee-789',
          'attorney-456',
          OversightRole.OversightAttorney,
        );

        expect(mockTrusteesRepository.updateTrusteeOversightAssignment).toHaveBeenCalledWith(
          'existing-assignment-id',
          expect.objectContaining({ unassignedOn: expect.any(String) }),
        );
        expect(mockTrusteesRepository.createTrusteeOversightAssignment).toHaveBeenCalled();
        expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      test('should proceed with assignment when no existing assignment for that role exists', async () => {
        const auditorAssignment = {
          ...mockAssignment,
          role: OversightRole.OversightAuditor,
        };
        mockTrusteesRepository.getTrusteeOversightAssignments.mockResolvedValue([
          auditorAssignment,
        ]);
        mockUserGroupGateway.getUserById.mockResolvedValue(MockData.getCamsUser());
        mockTrusteesRepository.createTrusteeOversightAssignment.mockResolvedValue(mockAssignment);
        mockTrusteesRepository.createTrusteeHistory.mockResolvedValue();

        const result = await useCase.assignOversightStaffToTrustee(
          context,
          'trustee-789',
          'attorney-456',
          OversightRole.OversightAttorney,
        );

        expect(result).toBe(true);
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

      test('should create new assignment when no existing assignment for that role', async () => {
        const result = await useCase.assignOversightStaffToTrustee(
          context,
          'trustee-789',
          'attorney-456',
          OversightRole.OversightAttorney,
        );

        expect(mockTrusteesRepository.getTrusteeOversightAssignments).toHaveBeenCalledWith(
          'trustee-789',
        );
        expect(mockUserGroupGateway.getUserById).toHaveBeenCalledWith(context, 'attorney-456');
        expect(mockTrusteesRepository.createTrusteeOversightAssignment).toHaveBeenCalled();
        expect(mockTrusteesRepository.createTrusteeHistory).toHaveBeenCalled();
        expect(result).toBe(true);
      });

      test('should create audit record with correct structure and provided role', async () => {
        await useCase.assignOversightStaffToTrustee(
          context,
          'trustee-789',
          'auditor-456',
          OversightRole.OversightAuditor,
        );

        const createAssignmentCall =
          mockTrusteesRepository.createTrusteeOversightAssignment.mock.calls[0][0];
        expect(createAssignmentCall).toHaveProperty('trusteeId', 'trustee-789');
        expect(createAssignmentCall).toHaveProperty('role', OversightRole.OversightAuditor);
        expect(createAssignmentCall).toHaveProperty('createdBy', expect.anything());
        expect(createAssignmentCall).toHaveProperty('createdOn', expect.anything());
      });

      test('should create history record with correct structure and provided role', async () => {
        await useCase.assignOversightStaffToTrustee(
          context,
          'trustee-789',
          'auditor-456',
          OversightRole.OversightAuditor,
        );

        const createHistoryCall = mockTrusteesRepository.createTrusteeHistory.mock.calls[0][0];
        expect(createHistoryCall).toHaveProperty('documentType', 'AUDIT_OVERSIGHT');
        expect(createHistoryCall).toHaveProperty('trusteeId', 'trustee-789');
        expect(createHistoryCall).toHaveProperty('before', null);
        expect((createHistoryCall as TrusteeOversightHistory).after).toHaveProperty(
          'role',
          OversightRole.OversightAuditor,
        );
      });

      test('should create paralegal assignment with correct structure', async () => {
        await useCase.assignOversightStaffToTrustee(
          context,
          'trustee-789',
          'paralegal-456',
          OversightRole.OversightParalegal,
        );

        const createAssignmentCall =
          mockTrusteesRepository.createTrusteeOversightAssignment.mock.calls[0][0];
        expect(createAssignmentCall).toHaveProperty('trusteeId', 'trustee-789');
        expect(createAssignmentCall).toHaveProperty('role', OversightRole.OversightParalegal);
        expect(createAssignmentCall).toHaveProperty('createdBy', expect.anything());
        expect(createAssignmentCall).toHaveProperty('createdOn', expect.anything());
      });

      test('should create paralegal history record with correct structure', async () => {
        await useCase.assignOversightStaffToTrustee(
          context,
          'trustee-789',
          'paralegal-456',
          OversightRole.OversightParalegal,
        );

        const createHistoryCall = mockTrusteesRepository.createTrusteeHistory.mock.calls[0][0];
        expect(createHistoryCall).toHaveProperty('documentType', 'AUDIT_OVERSIGHT');
        expect(createHistoryCall).toHaveProperty('trusteeId', 'trustee-789');
        expect(createHistoryCall).toHaveProperty('before', null);
        expect((createHistoryCall as TrusteeOversightHistory).after).toHaveProperty(
          'role',
          OversightRole.OversightParalegal,
        );
      });
    });

    describe('error handling', () => {
      const errorHandlingTestCases = [
        [
          'getUserById',
          () => {
            mockTrusteesRepository.getTrusteeOversightAssignments.mockResolvedValue([]);
            const getUserError = new Error('User not found');
            mockUserGroupGateway.getUserById.mockRejectedValue(getUserError);
            return getUserError;
          },
        ],
        [
          'createTrusteeOversightAssignment',
          () => {
            mockTrusteesRepository.getTrusteeOversightAssignments.mockResolvedValue([]);
            mockUserGroupGateway.getUserById.mockResolvedValue(MockData.getCamsUser());
            const createError = new Error('Database error');
            mockTrusteesRepository.createTrusteeOversightAssignment.mockRejectedValue(createError);
            return createError;
          },
        ],
        [
          'createTrusteeHistory',
          () => {
            mockTrusteesRepository.getTrusteeOversightAssignments.mockResolvedValue([]);
            mockUserGroupGateway.getUserById.mockResolvedValue(MockData.getCamsUser());
            mockTrusteesRepository.createTrusteeOversightAssignment.mockResolvedValue(
              mockAssignment,
            );
            const historyError = new Error('History creation failed');
            mockTrusteesRepository.createTrusteeHistory.mockRejectedValue(historyError);
            return historyError;
          },
        ],
        [
          'getTrusteeOversightAssignments',
          () => {
            const getAssignmentsError = new Error('Cannot retrieve assignments');
            mockTrusteesRepository.getTrusteeOversightAssignments.mockRejectedValue(
              getAssignmentsError,
            );
            return getAssignmentsError;
          },
        ],
      ] as const;

      test.each(errorHandlingTestCases)(
        'should wrap errors from %s',
        async (_methodName, setupError) => {
          const expectedError = setupError();

          mockErrorUtilities.getCamsError.mockReturnValue(
            new CamsError('TRUSTEE-ASSIGNMENTS-USE-CASE', { message: 'Wrapped error' }),
          );

          await expect(
            useCase.assignOversightStaffToTrustee(
              context,
              'trustee-789',
              'attorney-456',
              OversightRole.OversightAttorney,
            ),
          ).rejects.toThrow(CamsError);

          expect(mockErrorUtilities.getCamsError).toHaveBeenCalledWith(
            expectedError,
            'TRUSTEE-ASSIGNMENTS-USE-CASE',
          );
        },
      );
    });
  });
});
