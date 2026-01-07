import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAssignmentsController } from './trustee-assignments.controller';
import { TrusteeAssignmentsUseCase } from '../../use-cases/trustee-assignments/trustee-assignments';
import { BadRequestError } from '../../common-errors/bad-request';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { CamsRole } from '../../../../common/src/cams/roles';
import { TrusteeOversightAssignment } from '../../../../common/src/cams/trustees';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { CamsUserReference } from '../../../../common/src/cams/users';
import { NotFoundError } from '../../common-errors/not-found-error';

vi.mock('../../use-cases/trustee-assignments/trustee-assignments');

describe('TrusteeAssignmentsController', () => {
  let context: ApplicationContext;
  let controller: TrusteeAssignmentsController;
  let mockUseCase: vi.Mocked<TrusteeAssignmentsUseCase>;

  const mockUser: CamsUserReference = {
    id: 'user-123',
    name: 'Test User',
  };

  const mockAssignment: TrusteeOversightAssignment = {
    id: 'assignment-123',
    trusteeId: 'trustee-456',
    user: {
      id: 'user-789',
      name: 'Attorney Smith',
    },
    role: CamsRole.OversightAttorney,
    createdBy: {
      name: 'system',
      id: 'system',
    },
    createdOn: '2023-01-01T00:00:00.000Z',
    updatedBy: {
      name: 'system',
      id: 'system',
    },
    updatedOn: '2023-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    context = await createMockApplicationContext();
    context.session.user = { ...mockUser, roles: [CamsRole.TrialAttorney, CamsRole.SuperUser] };

    // Initialize featureFlags if it doesn't exist
    if (!context.featureFlags) {
      context.featureFlags = {};
    }

    mockUseCase = {
      getTrusteeOversightAssignments: vi.fn(),
      assignOversightStaffToTrustee: vi.fn(),
    } as unknown as vi.Mocked<TrusteeAssignmentsUseCase>;

    (
      TrusteeAssignmentsUseCase as vi.MockedClass<typeof TrusteeAssignmentsUseCase>
    ).mockImplementation(() => mockUseCase);

    controller = new TrusteeAssignmentsController(context);

    // Mock feature flag to be enabled by default
    context.featureFlags['trustee-management'] = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Feature flag protection', () => {
    test('should return 404 when trustee-management feature is disabled', async () => {
      context.featureFlags['trustee-management'] = false;
      context.request.method = 'GET';
      context.request.params = { trusteeId: 'trustee-456' };
      context.request.url = '/api/v1/trustees/trustee-456/oversight-assignments';

      await expect(controller.handleRequest(context)).rejects.toThrow(NotFoundError);
    });
  });

  describe('Authorization', () => {
    test('should throw UnauthorizedError when for unauthorized, sessionless requests', async () => {
      context.session = undefined;
      context.request.method = 'GET';
      context.request.params = { trusteeId: 'trustee-456' };
      context.request.url = '/api/v1/trustees/trustee-456/oversight-assignments';

      await expect(controller.handleRequest(context)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('GET /api/v1/trustees/{trusteeId}/oversight-assignments', () => {
    test('should return assignments for valid trustee ID', async () => {
      const assignments = [mockAssignment];
      mockUseCase.getTrusteeOversightAssignments.mockResolvedValue(assignments);

      context.request.method = 'GET';
      context.request.params = { trusteeId: 'trustee-456' };
      context.request.url = '/api/v1/trustees/trustee-456/oversight-assignments';

      const response = await controller.handleRequest(context);

      expect(mockUseCase.getTrusteeOversightAssignments).toHaveBeenCalledWith(
        context,
        'trustee-456',
      );
      expect(response.statusCode).toBe(200);
      expect(response.body.data).toEqual(assignments);
      expect(response.body.meta.self).toBe('/api/v1/trustees/trustee-456/oversight-assignments');
    });

    test('should throw BadRequestError when trustee ID is missing', async () => {
      context.request.method = 'GET';
      context.request.params = {};
      context.request.url = '/api/v1/trustees/oversight-assignments';

      await expect(controller.handleRequest(context)).rejects.toThrow(BadRequestError);
    });
  });

  describe('POST /api/v1/trustees/{trusteeId}/oversight-assignments', () => {
    test('should create attorney assignment with valid request including role', async () => {
      const requestBody = { userId: 'user-789', role: CamsRole.OversightAttorney };
      mockUseCase.assignOversightStaffToTrustee.mockResolvedValue(true);

      context.request.method = 'POST';
      context.request.params = { trusteeId: 'trustee-456' };
      context.request.body = requestBody;
      context.request.url = '/api/v1/trustees/trustee-456/oversight-assignments';

      const response = await controller.handleRequest(context);

      expect(mockUseCase.assignOversightStaffToTrustee).toHaveBeenCalledWith(
        context,
        'trustee-456',
        'user-789',
        CamsRole.OversightAttorney,
      );
      expect(response.statusCode).toBe(201);
      expect(response.body).toBeUndefined();
    });

    test('should create auditor assignment with valid request', async () => {
      const requestBody = { userId: 'user-789', role: CamsRole.OversightAuditor };
      mockUseCase.assignOversightStaffToTrustee.mockResolvedValue(true);

      context.request.method = 'POST';
      context.request.params = { trusteeId: 'trustee-456' };
      context.request.body = requestBody;
      context.request.url = '/api/v1/trustees/trustee-456/oversight-assignments';

      const response = await controller.handleRequest(context);

      expect(mockUseCase.assignOversightStaffToTrustee).toHaveBeenCalledWith(
        context,
        'trustee-456',
        'user-789',
        CamsRole.OversightAuditor,
      );
      expect(response.statusCode).toBe(201);
      expect(response.body).toBeUndefined();
    });

    test('should create paralegal assignment with valid request', async () => {
      const requestBody = { userId: 'user-789', role: CamsRole.OversightParalegal };
      mockUseCase.assignOversightStaffToTrustee.mockResolvedValue(true);

      context.request.method = 'POST';
      context.request.params = { trusteeId: 'trustee-456' };
      context.request.body = requestBody;
      context.request.url = '/api/v1/trustees/trustee-456/oversight-assignments';

      const response = await controller.handleRequest(context);

      expect(mockUseCase.assignOversightStaffToTrustee).toHaveBeenCalledWith(
        context,
        'trustee-456',
        'user-789',
        CamsRole.OversightParalegal,
      );
      expect(response.statusCode).toBe(201);
      expect(response.body).toBeUndefined();
    });

    test('should return 204 for idempotent attorney assignment request', async () => {
      const requestBody = { userId: 'user-789', role: CamsRole.OversightAttorney };
      mockUseCase.assignOversightStaffToTrustee.mockResolvedValue(false);

      context.request.method = 'POST';
      context.request.params = { trusteeId: 'trustee-456' };
      context.request.body = requestBody;
      context.request.url = '/api/v1/trustees/trustee-456/oversight-assignments';

      const response = await controller.handleRequest(context);

      expect(mockUseCase.assignOversightStaffToTrustee).toHaveBeenCalledWith(
        context,
        'trustee-456',
        'user-789',
        CamsRole.OversightAttorney,
      );
      expect(response.statusCode).toBe(204);
      expect(response.body).toBeUndefined();
    });

    test('should throw BadRequestError when request body is missing', async () => {
      context.request.method = 'POST';
      context.request.params = { trusteeId: 'trustee-456' };
      context.request.url = '/api/v1/trustees/trustee-456/oversight-assignments';

      await expect(controller.handleRequest(context)).rejects.toThrow(BadRequestError);
    });

    test('should throw BadRequestError when userId is missing from body', async () => {
      context.request.method = 'POST';
      context.request.params = { trusteeId: 'trustee-456' };
      context.request.body = { role: CamsRole.OversightAttorney };
      context.request.url = '/api/v1/trustees/trustee-456/oversight-assignments';

      await expect(controller.handleRequest(context)).rejects.toThrow(BadRequestError);
    });

    test('should throw BadRequestError when role is missing from body', async () => {
      context.request.method = 'POST';
      context.request.params = { trusteeId: 'trustee-456' };
      context.request.body = { userId: 'user-789' };
      context.request.url = '/api/v1/trustees/trustee-456/oversight-assignments';

      await expect(controller.handleRequest(context)).rejects.toThrow(BadRequestError);
    });

    test('should throw BadRequestError when role is not a valid OversightRole', async () => {
      context.request.method = 'POST';
      context.request.params = { trusteeId: 'trustee-456' };
      context.request.body = { userId: 'user-789', role: 'InvalidRole' };
      context.request.url = '/api/v1/trustees/trustee-456/oversight-assignments';

      mockUseCase.assignOversightStaffToTrustee.mockRejectedValue(
        new BadRequestError('TRUSTEE-ASSIGNMENTS-USE-CASE', {
          message: 'Role must be a valid oversight role. Received: InvalidRole',
        }),
      );

      await expect(controller.handleRequest(context)).rejects.toThrow(BadRequestError);
    });

    test('should throw BadRequestError when trustee ID is missing for POST', async () => {
      context.request.method = 'POST';
      context.request.params = {};
      context.request.body = { userId: 'user-789', role: CamsRole.OversightAttorney };
      context.request.url = '/api/v1/trustees/oversight-assignments';

      await expect(controller.handleRequest(context)).rejects.toThrow(BadRequestError);
      await expect(controller.handleRequest(context)).rejects.toMatchObject({
        message: 'Trustee ID is required',
      });
    });
  });

  describe('Unsupported HTTP methods', () => {
    test('should throw BadRequestError for PUT method', async () => {
      context.request.method = 'PUT';
      context.request.params = { trusteeId: 'trustee-456' };
      context.request.url = '/api/v1/trustees/trustee-456/oversight-assignments';

      await expect(controller.handleRequest(context)).rejects.toThrow(BadRequestError);
    });

    test('should throw BadRequestError for DELETE method', async () => {
      context.request.method = 'DELETE';
      context.request.params = { trusteeId: 'trustee-456' };
      context.request.url = '/api/v1/trustees/trustee-456/oversight-assignments';

      await expect(controller.handleRequest(context)).rejects.toThrow(BadRequestError);
    });
  });

  // New test suite for response format
  describe('TrusteeAssignmentsController - Response Format', () => {
    test('GET should return assignments with proper user display names', async () => {
      const assignments = [mockAssignment];
      mockUseCase.getTrusteeOversightAssignments.mockResolvedValue(assignments);

      context.request.method = 'GET';
      context.request.params = { trusteeId: 'trustee-456' };
      context.request.url = '/api/v1/trustees/trustee-456/oversight-assignments';

      const response = await controller.handleRequest(context);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].user).toBeDefined();
      expect(response.body.data[0].user.id).toBe('user-789');
      expect(response.body.data[0].user.name).toBe('Attorney Smith');
    });

    test('POST should successfully process assignment creation', async () => {
      const requestBody = { userId: 'user-789', role: CamsRole.OversightAttorney };
      mockUseCase.assignOversightStaffToTrustee.mockResolvedValue(true);

      context.request.method = 'POST';
      context.request.params = { trusteeId: 'trustee-456' };
      context.request.body = requestBody;
      context.request.url = '/api/v1/trustees/trustee-456/oversight-assignments';

      const response = await controller.handleRequest(context);

      expect(response.statusCode).toBe(201);
      expect(response.body).toBeUndefined();
    });

    test('should handle missing trusteeId parameter', async () => {
      context.request.method = 'GET';
      context.request.params = {};
      context.request.url = '/api/v1/trustees/oversight-assignments';

      await expect(controller.handleRequest(context)).rejects.toThrow(BadRequestError);
      await expect(controller.handleRequest(context)).rejects.toMatchObject({
        message: 'Trustee ID is required',
      });
    });
  });
});
