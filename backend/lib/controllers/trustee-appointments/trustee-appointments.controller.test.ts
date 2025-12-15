import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAppointmentsController } from './trustee-appointments.controller';
import { TrusteeAppointmentsUseCase } from '../../use-cases/trustee-appointments/trustee-appointments';
import { CamsUserReference } from '../../../../common/src/cams/users';
import { CamsRole } from '../../../../common/src/cams/roles';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';

// Mock the use case
jest.mock('../../use-cases/trustee-appointments/trustee-appointments');

describe('TrusteeAppointmentsController', () => {
  let context: ApplicationContext;
  let controller: TrusteeAppointmentsController;
  let mockUseCase: jest.Mocked<TrusteeAppointmentsUseCase>;

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
      getTrusteeAppointment: jest.fn(),
      getTrusteeAppointments: jest.fn(),
    } as unknown as jest.Mocked<TrusteeAppointmentsUseCase>;

    (
      TrusteeAppointmentsUseCase as jest.MockedClass<typeof TrusteeAppointmentsUseCase>
    ).mockImplementation(() => mockUseCase);

    controller = new TrusteeAppointmentsController(context);
    context.featureFlags['trustee-management'] = true;
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
      context.request.params['id'] = 'appointment-123';
      mockUseCase.getTrusteeAppointment.mockResolvedValue(sampleAppointment);

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

  describe('GET /api/trustee-appointments/:id', () => {
    beforeEach(() => {
      context.request.method = 'GET';
    });

    test('should return individual appointment for GET requests with ID', async () => {
      const id = 'appointment-123';
      mockUseCase.getTrusteeAppointment.mockResolvedValue(sampleAppointment);

      context.request.params['id'] = id;
      context.request.url = `/api/trustee-appointments/${id}`;

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual(sampleAppointment);
      expect(mockUseCase.getTrusteeAppointment).toHaveBeenCalledWith(context, id);
    });

    test('should handle appointment not found errors', async () => {
      const id = 'nonexistent-id';
      mockUseCase.getTrusteeAppointment.mockRejectedValue(
        new Error('Trustee appointment with ID nonexistent-id not found.'),
      );
      context.request.params['id'] = id;
      context.request.url = `/api/trustee-appointments/${id}`;

      await expect(controller.handleRequest(context)).rejects.toThrow();
    });
  });

  describe('GET /api/trustee-appointments?trusteeId=xxx', () => {
    beforeEach(() => {
      context.request.method = 'GET';
    });

    test('should return list of appointments for trustee', async () => {
      const trusteeId = 'trustee-123';
      const mockAppointments = [sampleAppointment, MockData.getTrusteeAppointment()];
      mockUseCase.getTrusteeAppointments.mockResolvedValue(mockAppointments);

      context.request.query = { trusteeId };
      context.request.url = `/api/trustee-appointments?trusteeId=${trusteeId}`;

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual(mockAppointments);
      expect(mockUseCase.getTrusteeAppointments).toHaveBeenCalledWith(context, trusteeId);
    });

    test('should throw error when neither ID nor trusteeId is provided', async () => {
      context.request.url = '/api/trustee-appointments';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'Either appointment ID or trusteeId query parameter is required',
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
