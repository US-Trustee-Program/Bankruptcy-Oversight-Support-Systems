import { vi, type Mocked, type MockedClass } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAppointmentsController } from './trustee-appointments.controller';
import { TrusteeAppointmentsUseCase } from '../../use-cases/trustee-appointments/trustee-appointments';
import { CamsUserReference } from '@common/cams/users';
import { CamsRole } from '@common/cams/roles';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import MockData from '@common/cams/test-utilities/mock-data';
import { NotFoundError } from '../../common-errors/not-found-error';
import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';

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
      createAppointment: vi.fn(),
      updateAppointment: vi.fn(),
    } as unknown as Mocked<TrusteeAppointmentsUseCase>;

    (
      TrusteeAppointmentsUseCase as MockedClass<typeof TrusteeAppointmentsUseCase>
    ).mockImplementation(function (this: TrusteeAppointmentsUseCase) {
      return mockUseCase;
    });

    controller = new TrusteeAppointmentsController(context);
    context.featureFlags['trustee-management'] = true;
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
        'User does not have permission to access trustee appointments',
      );
    });

    test('should deny access when user roles are undefined', async () => {
      delete context.session.user.roles;
      context.request.method = 'GET';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'User does not have permission to access trustee appointments',
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

  describe('POST /api/trustees/:trusteeId/appointments', () => {
    const appointmentInput: TrusteeAppointmentInput = {
      chapter: '7',
      appointmentType: 'panel',
      courtId: '081',
      divisionCode: '1',
      appointedDate: '2024-01-15',
      status: 'active',
      effectiveDate: '2024-01-15T00:00:00.000Z',
    };

    beforeEach(() => {
      context.request.method = 'POST';
    });

    test('should create a new appointment for a trustee', async () => {
      const trusteeId = 'trustee-123';
      const createdAppointment = MockData.getTrusteeAppointment({
        ...appointmentInput,
        id: 'appointment-456',
        trusteeId,
      });

      context.request.params = { trusteeId };
      context.request.body = appointmentInput;
      mockUseCase.createAppointment.mockResolvedValue(createdAppointment);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(201);
      expect(result.body?.meta?.self).toBe(`${context.request.url}/${createdAppointment.id}`);
      expect(result.body?.data).toBeUndefined();
      expect(mockUseCase.createAppointment).toHaveBeenCalledWith(
        context,
        trusteeId,
        appointmentInput,
      );
    });

    test('should require trustee ID', async () => {
      context.request.params = {};
      context.request.body = appointmentInput;

      await expect(controller.handleRequest(context)).rejects.toThrow('Trustee ID is required');
    });

    test('should require request body', async () => {
      const trusteeId = 'trustee-123';
      context.request.params = { trusteeId };
      context.request.body = undefined;

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'Request body is required for appointment creation',
      );
    });
  });

  describe('PUT /api/trustees/:trusteeId/appointments/:appointmentId', () => {
    const appointmentUpdate: TrusteeAppointmentInput = {
      chapter: '11',
      appointmentType: 'case-by-case',
      courtId: '081',
      divisionCode: '2',
      appointedDate: '2024-02-01',
      status: 'inactive',
      effectiveDate: '2024-02-15T00:00:00.000Z',
    };

    beforeEach(() => {
      context.request.method = 'PUT';
    });

    test('should update an appointment', async () => {
      const trusteeId = 'trustee-123';
      const appointmentId = 'appointment-456';
      const updatedAppointment = MockData.getTrusteeAppointment({
        ...appointmentUpdate,
        id: appointmentId,
        trusteeId,
      });

      context.request.params = { trusteeId, appointmentId };
      context.request.body = appointmentUpdate;
      mockUseCase.updateAppointment.mockResolvedValue(updatedAppointment);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.meta?.self).toBe(context.request.url);
      expect(result.body?.data).toBeUndefined();
      expect(mockUseCase.updateAppointment).toHaveBeenCalledWith(
        context,
        trusteeId,
        appointmentId,
        appointmentUpdate,
      );
    });

    test('should require trustee ID', async () => {
      context.request.params = { appointmentId: 'appointment-456' };
      context.request.body = appointmentUpdate;

      await expect(controller.handleRequest(context)).rejects.toThrow('Trustee ID is required');
    });

    test('should require appointment ID', async () => {
      context.request.params = { trusteeId: 'trustee-123' };
      context.request.body = appointmentUpdate;

      await expect(controller.handleRequest(context)).rejects.toThrow('Appointment ID is required');
    });

    test('should require request body', async () => {
      const trusteeId = 'trustee-123';
      const appointmentId = 'appointment-456';
      context.request.params = { trusteeId, appointmentId };
      context.request.body = undefined;

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'Request body is required for appointment update',
      );
    });
  });

  describe('Error handling', () => {
    test('should reject unsupported HTTP methods', async () => {
      context.request.method = 'DELETE';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'HTTP method DELETE is not supported',
      );
    });
  });
});
