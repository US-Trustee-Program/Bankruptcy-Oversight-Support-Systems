import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeStaffController } from './trustee-staff.controller';
import { TrusteeStaffUseCase } from '../../use-cases/trustee-staff/trustee-staff';
import { CamsUserReference } from '@common/cams/users';
import { CamsRole } from '@common/cams/roles';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeStaffInput } from '@common/cams/trustee-staff';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import MockData from '@common/cams/test-utilities/mock-data';

describe('TrusteeStaffController', () => {
  let context: ApplicationContext;
  let controller: TrusteeStaffController;

  const mockUser: CamsUserReference = {
    id: 'user123',
    name: 'Test User',
  };

  const sampleStaffMember = MockData.getTrusteeStaff();

  const staffInput: TrusteeStaffInput = {
    name: 'Jane Staff',
    title: 'Senior Legal Staff',
    contact: {
      address: {
        address1: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        countryCode: 'US',
      },
      phone: {
        number: '555-123-4567',
      },
      email: 'jane@example.com',
    },
  };

  beforeEach(async () => {
    context = await createMockApplicationContext();
    context.session.user = { ...mockUser, roles: [CamsRole.TrusteeAdmin] };

    if (!context.featureFlags) {
      context.featureFlags = {};
    }

    controller = new TrusteeStaffController(context);
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
      vi.spyOn(TrusteeStaffUseCase.prototype, 'getTrusteeStaff').mockResolvedValue([
        sampleStaffMember,
      ]);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
    });

    test('should deny access for users without TrusteeAdmin role', async () => {
      context.session.user.roles = [CamsRole.TrialAttorney];
      context.request.method = 'GET';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'User does not have permission to access trustee staff',
      );
    });

    test('should deny access when user roles are undefined', async () => {
      delete context.session.user.roles;
      context.request.method = 'GET';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'User does not have permission to access trustee staff',
      );
    });
  });

  describe('GET /api/trustees/:trusteeId/staff', () => {
    beforeEach(() => {
      context.request.method = 'GET';
    });

    test('should return list of staff for trustee', async () => {
      const trusteeId = 'trustee-123';
      const staffMember1 = MockData.getTrusteeStaff({ trusteeId });
      const staffMember2 = MockData.getTrusteeStaff({ trusteeId });

      context.request.params['trusteeId'] = trusteeId;
      context.request.url = `/api/trustees/${trusteeId}/staff`;
      const getTrusteeStaffSpy = vi
        .spyOn(TrusteeStaffUseCase.prototype, 'getTrusteeStaff')
        .mockResolvedValue([staffMember1, staffMember2]);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual([staffMember1, staffMember2]);
      expect(result.body?.meta).toEqual({
        self: `/api/trustees/${trusteeId}/staff`,
      });
      expect(getTrusteeStaffSpy).toHaveBeenCalledWith(context, trusteeId);
    });

    test('should return empty array when trustee has no staff', async () => {
      const trusteeId = 'trustee-456';

      context.request.params['trusteeId'] = trusteeId;
      context.request.url = `/api/trustees/${trusteeId}/staff`;
      const getTrusteeStaffSpy = vi
        .spyOn(TrusteeStaffUseCase.prototype, 'getTrusteeStaff')
        .mockResolvedValue([]);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual([]);
      expect(getTrusteeStaffSpy).toHaveBeenCalledWith(context, trusteeId);
    });

    test('should return 400 when trusteeId is missing', async () => {
      context.request.params = {};

      await expect(controller.handleRequest(context)).rejects.toThrow('Trustee ID is required');
    });

    test('should propagate use case errors', async () => {
      const trusteeId = 'trustee-123';
      context.request.params['trusteeId'] = trusteeId;
      vi.spyOn(TrusteeStaffUseCase.prototype, 'getTrusteeStaff').mockRejectedValue(
        new Error('Trustee not found'),
      );

      await expect(controller.handleRequest(context)).rejects.toThrow();
    });
  });

  describe('GET /api/trustees/:trusteeId/staff/:staffId', () => {
    beforeEach(() => {
      context.request.method = 'GET';
    });

    test('should return single staff member by ID', async () => {
      const trusteeId = 'trustee-123';
      const staffId = 'staff-456';
      const staffMember = MockData.getTrusteeStaff({ id: staffId, trusteeId });

      context.request.params['trusteeId'] = trusteeId;
      context.request.params['staffId'] = staffId;
      context.request.url = `/api/trustees/${trusteeId}/staff/${staffId}`;
      const getStaffMemberSpy = vi
        .spyOn(TrusteeStaffUseCase.prototype, 'getStaffMember')
        .mockResolvedValue(staffMember);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual(staffMember);
      expect(result.body?.meta).toEqual({
        self: `/api/trustees/${trusteeId}/staff/${staffId}`,
      });
      expect(getStaffMemberSpy).toHaveBeenCalledWith(context, trusteeId, staffId);
    });

    test('should return list when staffId is missing', async () => {
      const trusteeId = 'trustee-123';
      const staff = [MockData.getTrusteeStaff({ trusteeId })];
      context.request.params = { trusteeId };
      context.request.url = `/api/trustees/${trusteeId}/staff`;
      const getTrusteeStaffSpy = vi
        .spyOn(TrusteeStaffUseCase.prototype, 'getTrusteeStaff')
        .mockResolvedValue(staff);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual(staff);
      expect(getTrusteeStaffSpy).toHaveBeenCalledWith(context, trusteeId);
    });

    test('should propagate use case errors when staff member not found', async () => {
      const trusteeId = 'trustee-123';
      const staffId = 'non-existent';
      context.request.params['trusteeId'] = trusteeId;
      context.request.params['staffId'] = staffId;
      vi.spyOn(TrusteeStaffUseCase.prototype, 'getStaffMember').mockRejectedValue(
        new Error('Staff member not found'),
      );

      await expect(controller.handleRequest(context)).rejects.toThrow();
    });
  });

  describe('POST /api/trustees/:trusteeId/staff', () => {
    beforeEach(() => {
      context.request.method = 'POST';
    });

    test('should create a new staff member for a trustee', async () => {
      const trusteeId = 'trustee-123';
      const createdStaffMember = {
        ...staffInput,
        id: 'staff-456',
        trusteeId,
        updatedBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2024-01-01T00:00:00Z',
      };

      context.request.params = { trusteeId };
      context.request.body = staffInput;
      context.request.url = `/api/trustees/${trusteeId}/staff`;
      const createStaffMemberSpy = vi
        .spyOn(TrusteeStaffUseCase.prototype, 'createStaffMember')
        .mockResolvedValue(createdStaffMember);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(201);
      expect(result.body?.meta?.self).toBe(
        `/api/trustees/${trusteeId}/staff/${createdStaffMember.id}`,
      );
      expect(createStaffMemberSpy).toHaveBeenCalledWith(context, trusteeId, staffInput);
    });

    test('should throw error when trusteeId is not provided', async () => {
      context.request.params = {};
      context.request.body = staffInput;

      await expect(controller.handleRequest(context)).rejects.toThrow('Trustee ID is required');
    });

    test('should throw error when request body is missing', async () => {
      context.request.params = { trusteeId: 'trustee-123' };
      context.request.body = undefined;

      await expect(controller.handleRequest(context)).rejects.toThrow('Request body is required');
    });

    test('should propagate use case validation errors', async () => {
      const trusteeId = 'trustee-123';
      context.request.params = { trusteeId };
      context.request.body = staffInput;
      vi.spyOn(TrusteeStaffUseCase.prototype, 'createStaffMember').mockRejectedValue(
        new Error('Validation failed'),
      );

      await expect(controller.handleRequest(context)).rejects.toThrow();
    });
  });

  describe('PUT /api/trustees/:trusteeId/staff/:staffId', () => {
    beforeEach(() => {
      context.request.method = 'PUT';
    });

    test('should update an existing staff member', async () => {
      const trusteeId = 'trustee-123';
      const staffId = 'staff-456';
      const updatedStaffMember = {
        ...staffInput,
        id: staffId,
        trusteeId,
        updatedBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2024-01-02T00:00:00Z',
      };

      context.request.params = { trusteeId, staffId };
      context.request.body = staffInput;
      context.request.url = `/api/trustees/${trusteeId}/staff/${staffId}`;
      const updateStaffMemberSpy = vi
        .spyOn(TrusteeStaffUseCase.prototype, 'updateStaffMember')
        .mockResolvedValue(updatedStaffMember);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.meta?.self).toBe(`/api/trustees/${trusteeId}/staff/${staffId}`);
      expect(updateStaffMemberSpy).toHaveBeenCalledWith(context, trusteeId, staffId, staffInput);
    });

    test('should throw error when trusteeId is not provided', async () => {
      context.request.params = { staffId: 'staff-456' };
      context.request.body = staffInput;

      await expect(controller.handleRequest(context)).rejects.toThrow('Trustee ID is required');
    });

    test('should throw error when staffId is not provided', async () => {
      context.request.params = { trusteeId: 'trustee-123' };
      context.request.body = staffInput;

      await expect(controller.handleRequest(context)).rejects.toThrow('Staff ID is required');
    });

    test('should throw error when request body is missing', async () => {
      context.request.params = { trusteeId: 'trustee-123', staffId: 'staff-456' };
      context.request.body = undefined;

      await expect(controller.handleRequest(context)).rejects.toThrow('Request body is required');
    });

    test('should propagate use case validation errors', async () => {
      const trusteeId = 'trustee-123';
      const staffId = 'staff-456';
      context.request.params = { trusteeId, staffId };
      context.request.body = staffInput;
      vi.spyOn(TrusteeStaffUseCase.prototype, 'updateStaffMember').mockRejectedValue(
        new Error('Validation failed'),
      );

      await expect(controller.handleRequest(context)).rejects.toThrow();
    });
  });

  describe('DELETE /api/trustees/:trusteeId/staff/:staffId', () => {
    beforeEach(() => {
      context.request.method = 'DELETE';
    });

    test('should delete a staff member and return 204', async () => {
      const trusteeId = 'trustee-123';
      const staffId = 'staff-456';

      context.request.params = { trusteeId, staffId };
      context.request.url = `/api/trustees/${trusteeId}/staff/${staffId}`;
      const deleteStaffMemberSpy = vi
        .spyOn(TrusteeStaffUseCase.prototype, 'deleteStaffMember')
        .mockResolvedValue(undefined);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(204);
      expect(deleteStaffMemberSpy).toHaveBeenCalledWith(context, trusteeId, staffId);
    });

    test('should throw error when trusteeId is not provided', async () => {
      context.request.params = { staffId: 'staff-456' };

      await expect(controller.handleRequest(context)).rejects.toThrow('Trustee ID is required');
    });

    test('should throw error when staffId is not provided', async () => {
      context.request.params = { trusteeId: 'trustee-123' };

      await expect(controller.handleRequest(context)).rejects.toThrow('Staff ID is required');
    });

    test('should propagate use case errors', async () => {
      const trusteeId = 'trustee-123';
      const staffId = 'staff-456';
      context.request.params = { trusteeId, staffId };
      vi.spyOn(TrusteeStaffUseCase.prototype, 'deleteStaffMember').mockRejectedValue(
        new Error('Staff member not found'),
      );

      await expect(controller.handleRequest(context)).rejects.toThrow();
    });
  });

  describe('Unsupported HTTP methods', () => {
    test('should return BadRequestError for PATCH method', async () => {
      context.request.method = 'PATCH';
      context.request.params['trusteeId'] = 'trustee-123';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'HTTP method PATCH is not supported',
      );
    });
  });
});
