import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteesRepository } from '../gateways.types';
import { TrusteeOversightAssignment } from '../../../../common/src/cams/trustees';
import { CamsUserReference } from '../../../../common/src/cams/users';
import { OversightRole } from '../../../../common/src/cams/roles';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { closeDeferred } from '../../deferrable/defer-close';
import * as factoryModule from '../../factory';
import * as sessionModule from '../../../../common/src/cams/session';

import { BadRequestError } from '../../common-errors/bad-request';
import { TrusteeAssignmentsUseCase } from './trustee-assignments';
import MockUserGroupGateway from '../../testing/mock-gateways/mock-user-group-gateway';

const MODULE_NAME = 'TRUSTEE-ASSIGNMENTS-USE-CASE';

describe('TrusteeAssignmentsUseCase', () => {
  let context: ApplicationContext;
  let useCase: TrusteeAssignmentsUseCase;
  let mockRepository: jest.Mocked<TrusteesRepository>;
  let mockUser: CamsUserReference;

  beforeEach(async () => {
    context = await createMockApplicationContext();

    // Mock logger methods
    context.logger.info = jest.fn();
    context.logger.error = jest.fn();
    context.logger.debug = jest.fn();
    context.logger.warn = jest.fn();

    mockUser = {
      id: 'attorney-123',
      name: 'John Attorney',
    };

    // Set up mock session
    jest.spyOn(sessionModule, 'getCamsUserReference').mockReturnValue(mockUser);

    // Set up mock repository
    mockRepository = {
      getTrusteeOversightAssignments: jest.fn(),
      createTrusteeOversightAssignment: jest.fn(),
      read: jest.fn(),
      createTrustee: jest.fn(),
      createTrusteeHistory: jest.fn(),
      listTrusteeHistory: jest.fn(),
      listTrustees: jest.fn(),
      updateTrustee: jest.fn(),
      release: jest.fn(),
    } as jest.Mocked<TrusteesRepository>;

    jest.spyOn(factoryModule, 'getTrusteesRepository').mockReturnValue(mockRepository);

    useCase = new TrusteeAssignmentsUseCase(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    jest.restoreAllMocks();
  });

  describe('getTrusteeOversightAssignments', () => {
    test('should retrieve oversight assignments for a trustee successfully', async () => {
      const trusteeId = 'trustee-123';
      const expectedAssignments: TrusteeOversightAssignment[] = [
        {
          id: 'assignment-1',
          trusteeId,
          user: {
            id: 'attorney-1',
            name: 'John Attorney',
          },
          role: OversightRole.OversightAttorney,
          createdOn: '2025-10-07T10:00:00Z',
          createdBy: mockUser,
          updatedOn: '2025-10-07T10:00:00Z',
          updatedBy: mockUser,
        },
      ];

      mockRepository.getTrusteeOversightAssignments.mockResolvedValue(expectedAssignments);

      const result = await useCase.getTrusteeOversightAssignments(context, trusteeId);

      expect(mockRepository.getTrusteeOversightAssignments).toHaveBeenCalledWith(trusteeId);
      expect(result).toEqual(expectedAssignments);
      expect(context.logger.info).toHaveBeenCalledWith(
        MODULE_NAME,
        `Retrieved ${expectedAssignments.length} oversight assignments for trustee ${trusteeId}`,
      );
    });

    test('should throw BadRequestError for empty trusteeId', async () => {
      await expect(useCase.getTrusteeOversightAssignments(context, '')).rejects.toThrow(
        BadRequestError,
      );

      expect(mockRepository.getTrusteeOversightAssignments).not.toHaveBeenCalled();
    });

    test('should throw BadRequestError for whitespace-only trusteeId', async () => {
      await expect(useCase.getTrusteeOversightAssignments(context, '   ')).rejects.toThrow(
        BadRequestError,
      );

      expect(mockRepository.getTrusteeOversightAssignments).not.toHaveBeenCalled();
    });

    test('should return empty array when no assignments exist', async () => {
      const trusteeId = 'trustee-no-assignments';
      mockRepository.getTrusteeOversightAssignments.mockResolvedValue([]);

      const result = await useCase.getTrusteeOversightAssignments(context, trusteeId);

      expect(mockRepository.getTrusteeOversightAssignments).toHaveBeenCalledWith(trusteeId);
      expect(result).toEqual([]);
      expect(context.logger.info).toHaveBeenCalledWith(
        MODULE_NAME,
        `Retrieved 0 oversight assignments for trustee ${trusteeId}`,
      );
    });

    test('should handle database errors when retrieving assignments', async () => {
      const trusteeId = 'trustee-123';
      const error = new Error('Database connection failed');

      mockRepository.getTrusteeOversightAssignments.mockRejectedValue(error);

      await expect(useCase.getTrusteeOversightAssignments(context, trusteeId)).rejects.toThrow();

      expect(mockRepository.getTrusteeOversightAssignments).toHaveBeenCalledWith(trusteeId);
      expect(context.logger.error).toHaveBeenCalledWith(
        MODULE_NAME,
        `Failed to retrieve oversight assignments for trustee ${trusteeId}.`,
        error,
      );
    });

    test('should re-throw BadRequestError from repository without modification', async () => {
      const trusteeId = 'trustee-123';
      const badRequestError = new BadRequestError(MODULE_NAME, {
        message: 'Invalid trustee ID format',
      });

      mockRepository.getTrusteeOversightAssignments.mockRejectedValue(badRequestError);

      await expect(useCase.getTrusteeOversightAssignments(context, trusteeId)).rejects.toThrow(
        BadRequestError,
      );
      await expect(
        useCase.getTrusteeOversightAssignments(context, trusteeId),
      ).rejects.toMatchObject({
        message: 'Invalid trustee ID format',
      });

      expect(mockRepository.getTrusteeOversightAssignments).toHaveBeenCalledWith(trusteeId);
      expect(context.logger.error).not.toHaveBeenCalled(); // Should not log BadRequestError
    });
  });

  describe('assignAttorneyToTrustee', () => {
    test('should throw BadRequestError for empty trusteeId', async () => {
      await expect(useCase.assignAttorneyToTrustee(context, '', 'attorney-123')).rejects.toThrow(
        BadRequestError,
      );

      expect(mockRepository.getTrusteeOversightAssignments).not.toHaveBeenCalled();
      expect(mockRepository.createTrusteeOversightAssignment).not.toHaveBeenCalled();
    });

    test('should throw BadRequestError for empty attorneyUserId', async () => {
      await expect(useCase.assignAttorneyToTrustee(context, 'trustee-123', '')).rejects.toThrow(
        BadRequestError,
      );

      expect(mockRepository.getTrusteeOversightAssignments).not.toHaveBeenCalled();
      expect(mockRepository.createTrusteeOversightAssignment).not.toHaveBeenCalled();
    });

    test('should throw BadRequestError for whitespace-only trusteeId', async () => {
      await expect(useCase.assignAttorneyToTrustee(context, '   ', 'attorney-123')).rejects.toThrow(
        BadRequestError,
      );

      expect(mockRepository.getTrusteeOversightAssignments).not.toHaveBeenCalled();
      expect(mockRepository.createTrusteeOversightAssignment).not.toHaveBeenCalled();
    });

    test('should throw BadRequestError for whitespace-only attorneyUserId', async () => {
      await expect(useCase.assignAttorneyToTrustee(context, 'trustee-123', '   ')).rejects.toThrow(
        BadRequestError,
      );

      expect(mockRepository.getTrusteeOversightAssignments).not.toHaveBeenCalled();
      expect(mockRepository.createTrusteeOversightAssignment).not.toHaveBeenCalled();
    });

    test('should create attorney assignment successfully', async () => {
      const trusteeId = 'trustee-123';
      const attorneyUserId = 'attorney-456';

      const assignmentInput = {
        trusteeId,
        user: {
          id: attorneyUserId,
          name: 'Jane Attorney',
        },
        role: OversightRole.OversightAttorney,
      };

      jest
        .spyOn(MockUserGroupGateway.prototype, 'getUserById')
        .mockResolvedValue(assignmentInput.user);

      const expectedAssignment: TrusteeOversightAssignment = {
        id: 'assignment-123',
        ...assignmentInput,
        createdOn: '2025-10-07T10:00:00Z',
        createdBy: mockUser,
        updatedOn: '2025-10-07T10:00:00Z',
        updatedBy: mockUser,
      };

      // Mock no existing attorney assignment
      mockRepository.getTrusteeOversightAssignments.mockResolvedValue([]);
      mockRepository.createTrusteeOversightAssignment.mockResolvedValue(expectedAssignment);

      const result = await useCase.assignAttorneyToTrustee(context, trusteeId, attorneyUserId);

      expect(mockRepository.getTrusteeOversightAssignments).toHaveBeenCalledWith(trusteeId);
      expect(mockRepository.createTrusteeOversightAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          trusteeId,
          user: expect.objectContaining({
            id: assignmentInput.user.id,
            name: assignmentInput.user.name,
          }),
          role: OversightRole.OversightAttorney,
        }),
      );
      expect(result).toEqual(expectedAssignment);
      expect(context.logger.info).toHaveBeenCalledWith(
        MODULE_NAME,
        `Created attorney assignment for trustee ${trusteeId} with user ${attorneyUserId}`,
      );
    });

    test('should create assignment successfully even when audit trail creation fails', async () => {
      const trusteeId = 'trustee-123';
      const attorneyUserId = 'attorney-456';

      const assignmentInput = {
        trusteeId,
        user: {
          id: attorneyUserId,
          name: 'Jane Attorney',
        },
        role: OversightRole.OversightAttorney,
      };

      jest
        .spyOn(MockUserGroupGateway.prototype, 'getUserById')
        .mockResolvedValue(assignmentInput.user);

      const expectedAssignment: TrusteeOversightAssignment = {
        id: 'assignment-123',
        ...assignmentInput,
        createdOn: '2025-10-07T10:00:00Z',
        createdBy: mockUser,
        updatedOn: '2025-10-07T10:00:00Z',
        updatedBy: mockUser,
      };

      // Mock no existing attorney assignment
      mockRepository.getTrusteeOversightAssignments.mockResolvedValue([]);
      mockRepository.createTrusteeOversightAssignment.mockResolvedValue(expectedAssignment);

      // Make audit trail creation fail
      const auditError = new Error('Audit service unavailable');
      mockRepository.createTrusteeHistory.mockRejectedValue(auditError);

      const result = await useCase.assignAttorneyToTrustee(context, trusteeId, attorneyUserId);

      expect(result).toEqual(expectedAssignment);
      expect(mockRepository.createTrusteeHistory).toHaveBeenCalled();
      expect(context.logger.error).toHaveBeenCalledWith(
        MODULE_NAME,
        `Failed to create audit trail for assignment ${expectedAssignment.id}`,
        auditError,
      );
      expect(context.logger.info).toHaveBeenCalledWith(
        MODULE_NAME,
        `Created attorney assignment for trustee ${trusteeId} with user ${attorneyUserId}`,
      );
    });

    test('should prevent duplicate attorney assignments for same trustee', async () => {
      const trusteeId = 'trustee-123';
      const attorneyUserId = 'attorney-456';

      const existingAssignment: TrusteeOversightAssignment = {
        id: 'existing-assignment',
        trusteeId,
        user: {
          id: 'other-attorney-789',
          name: 'Other Attorney',
        },
        role: OversightRole.OversightAttorney,
        createdOn: '2025-10-07T09:00:00Z',
        createdBy: mockUser,
        updatedOn: '2025-10-07T09:00:00Z',
        updatedBy: mockUser,
      };

      mockRepository.getTrusteeOversightAssignments.mockResolvedValue([existingAssignment]);

      await expect(
        useCase.assignAttorneyToTrustee(context, trusteeId, attorneyUserId),
      ).rejects.toThrow(BadRequestError);

      expect(mockRepository.getTrusteeOversightAssignments).toHaveBeenCalledWith(trusteeId);
      expect(mockRepository.createTrusteeOversightAssignment).not.toHaveBeenCalled();
    });

    test('should handle idempotent assignment requests', async () => {
      const trusteeId = 'trustee-123';
      const attorneyUserId = 'attorney-456';

      const existingAssignment: TrusteeOversightAssignment = {
        id: 'existing-assignment',
        trusteeId,
        user: {
          id: attorneyUserId, // Same attorney
          name: 'Jane Attorney',
        },
        role: OversightRole.OversightAttorney,
        createdOn: '2025-10-07T09:00:00Z',
        createdBy: mockUser,
        updatedOn: '2025-10-07T09:00:00Z',
        updatedBy: mockUser,
      };

      mockRepository.getTrusteeOversightAssignments.mockResolvedValue([existingAssignment]);

      const result = await useCase.assignAttorneyToTrustee(context, trusteeId, attorneyUserId);

      expect(mockRepository.getTrusteeOversightAssignments).toHaveBeenCalledWith(trusteeId);
      expect(mockRepository.createTrusteeOversightAssignment).not.toHaveBeenCalled();
      expect(result).toEqual(existingAssignment);
      expect(context.logger.info).toHaveBeenCalledWith(
        MODULE_NAME,
        `Attorney ${attorneyUserId} already assigned to trustee ${trusteeId}`,
      );
    });

    test('should handle database errors when creating assignments', async () => {
      const trusteeId = 'trustee-123';
      const attorneyUserId = 'attorney-456';
      const databaseError = new Error('Database connection failed');
      const mockAssignedAttorney = {
        id: attorneyUserId,
        name: 'Jane Attorney',
      };

      // Mock getUserById to return a user
      jest
        .spyOn(MockUserGroupGateway.prototype, 'getUserById')
        .mockResolvedValue(mockAssignedAttorney);

      // Mock no existing assignments and database failure on creation
      mockRepository.getTrusteeOversightAssignments.mockResolvedValue([]);
      mockRepository.createTrusteeOversightAssignment.mockRejectedValue(databaseError);

      // Should throw an error (wrapped as UnknownError by getCamsError)
      await expect(
        useCase.assignAttorneyToTrustee(context, trusteeId, attorneyUserId),
      ).rejects.toThrow('Unknown Error');
    });
  });
});
