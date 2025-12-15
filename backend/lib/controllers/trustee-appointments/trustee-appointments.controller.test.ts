import { vi, type Mocked, type MockedClass } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAppointmentsController } from './trustee-appointments.controller';
import { TrusteeAppointmentsUseCase } from '../../use-cases/trustee-appointments/trustee-appointments';
import { CamsUserReference } from '../../../../common/src/cams/users';
import { CamsRole } from '../../../../common/src/cams/roles';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { NotFoundError } from '../../common-errors/not-found-error';

// Mock the use case
vi.mock('../../use-cases/trustee-appointments/trustee-appointments');

describe('TrusteeAppointmentsController', () => {
  let context: ApplicationContext;
  let controller: TrusteeAppointmentsController;
  let mockUseCase: Mocked<TrusteeAppointmentsUseCase>;

  const mockUser: CamsUserReference = {
    id: 'user123',
    name: 'Test User',
  };

  const sampleAppointment = MockData.getTrusteeAppointment();

  beforeEach(async () => {
    context = await createMockApplicationContext();
    context.session.user = { ...mockUser, roles: [CamsRole.TrusteeAdmin] };

    if (!context.featureFlags) {
      context.featureFlags = {};
    }

    mockUseCase = {
      getTrusteeAppointments: vi.fn(),
    } as unknown as Mocked<TrusteeAppointmentsUseCase>;

    (
      TrusteeAppointmentsUseCase as unknown as MockedClass<typeof TrusteeAppointmentsUseCase>
    ).mockImplementation(() => mockUseCase);

    controller = new TrusteeAppointmentsController(context);
    context.featureFlags['trustee-management'] = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Feature flag protection', () => {
    test('should return 404 when trustee-management feature is disabled', async () => {
      context.featureFlags['trustee-management'] = false;
      context.request.method = 'GET';

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(404);
    });
  });

  describe('Role-based authorization', () => {
    test('should allow access for users with TrusteeAdmin role', async () => {
      context.request.method = 'GET';
      context.request.params['trusteeId'] = 'trustee-123';
      mockUseCase.getTrusteeAppointments.mockResolvedValue([sampleAppointment]);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
    });

    test('should deny access for users without TrusteeAdmin role', async () => {
      context.session.user.roles = [CamsRole.TrialAttorney];
      context.request.method = 'GET';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'User does not have permission to view trustee appointments',
      );
    });

    test('should deny access when user roles are undefined', async () => {
      delete context.session.user.roles;
      context.request.method = 'GET';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'User does not have permission to view trustee appointments',
      );
    });
  });

  describe('GET /api/trustees/:trusteeId/appointments', () => {
    beforeEach(() => {
      context.request.method = 'GET';
    });

    test('should return list of appointments for trustee', async () => {
      const trusteeId = 'trustee-123';
      const mockAppointments = [sampleAppointment, MockData.getTrusteeAppointment()];
      mockUseCase.getTrusteeAppointments.mockResolvedValue(mockAppointments);

      context.request.params['trusteeId'] = trusteeId;
      context.request.url = `/api/trustees/${trusteeId}/appointments`;

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual(mockAppointments);
      expect(mockUseCase.getTrusteeAppointments).toHaveBeenCalledWith(context, trusteeId);
    });

    test('should return empty array when trustee has no appointments', async () => {
      const trusteeId = 'trustee-456';
      mockUseCase.getTrusteeAppointments.mockResolvedValue([]);

      context.request.params['trusteeId'] = trusteeId;
      context.request.url = `/api/trustees/${trusteeId}/appointments`;

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual([]);
    });

    test('should throw error when trusteeId is not provided', async () => {
      context.request.url = '/api/trustees/appointments';

      await expect(controller.handleRequest(context)).rejects.toThrow('Trustee ID is required');
    });

    test('should handle trustee not found errors', async () => {
      const trusteeId = 'nonexistent-trustee';
      mockUseCase.getTrusteeAppointments.mockRejectedValue(
        new NotFoundError('TRUSTEE-APPOINTMENTS-USE-CASE', {
          message: `Trustee with ID ${trusteeId} not found.`,
        }),
      );
      context.request.params['trusteeId'] = trusteeId;
      context.request.url = `/api/trustees/${trusteeId}/appointments`;

      await expect(controller.handleRequest(context)).rejects.toThrow(
        `Trustee with ID ${trusteeId} not found.`,
      );
    });
  });

  describe('Error handling', () => {
    test('should reject unsupported HTTP methods', async () => {
      context.request.method = 'POST';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'HTTP method POST is not supported',
      );
    });
  });
});
