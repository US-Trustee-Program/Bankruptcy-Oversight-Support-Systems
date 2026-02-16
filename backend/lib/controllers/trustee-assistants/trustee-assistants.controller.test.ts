import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAssistantsController } from './trustee-assistants.controller';
import { TrusteeAssistantsUseCase } from '../../use-cases/trustee-assistants/trustee-assistants';
import { CamsUserReference } from '@common/cams/users';
import { CamsRole } from '@common/cams/roles';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeAssistantInput } from '@common/cams/trustee-assistants';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import MockData from '@common/cams/test-utilities/mock-data';

describe('TrusteeAssistantsController', () => {
  let context: ApplicationContext;
  let controller: TrusteeAssistantsController;

  const mockUser: CamsUserReference = {
    id: 'user123',
    name: 'Test User',
  };

  const sampleAssistant = MockData.getTrusteeAssistant();

  const assistantInput: TrusteeAssistantInput = {
    name: 'Jane Assistant',
    title: 'Senior Legal Assistant',
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

    controller = new TrusteeAssistantsController(context);
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
      vi.spyOn(TrusteeAssistantsUseCase.prototype, 'getTrusteeAssistants').mockResolvedValue([
        sampleAssistant,
      ]);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
    });

    test('should deny access for users without TrusteeAdmin role', async () => {
      context.session.user.roles = [CamsRole.TrialAttorney];
      context.request.method = 'GET';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'User does not have permission to access trustee assistants',
      );
    });

    test('should deny access when user roles are undefined', async () => {
      delete context.session.user.roles;
      context.request.method = 'GET';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'User does not have permission to access trustee assistants',
      );
    });
  });

  describe('GET /api/trustees/:trusteeId/assistants', () => {
    beforeEach(() => {
      context.request.method = 'GET';
    });

    test('should return list of assistants for trustee', async () => {
      const trusteeId = 'trustee-123';
      const assistant1 = MockData.getTrusteeAssistant({ trusteeId });
      const assistant2 = MockData.getTrusteeAssistant({ trusteeId });

      context.request.params['trusteeId'] = trusteeId;
      context.request.url = `/api/trustees/${trusteeId}/assistants`;
      const getTrusteeAssistantsSpy = vi
        .spyOn(TrusteeAssistantsUseCase.prototype, 'getTrusteeAssistants')
        .mockResolvedValue([assistant1, assistant2]);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual([assistant1, assistant2]);
      expect(result.body?.meta).toEqual({
        self: `/api/trustees/${trusteeId}/assistants`,
      });
      expect(getTrusteeAssistantsSpy).toHaveBeenCalledWith(context, trusteeId);
    });

    test('should return empty array when trustee has no assistants', async () => {
      const trusteeId = 'trustee-456';

      context.request.params['trusteeId'] = trusteeId;
      context.request.url = `/api/trustees/${trusteeId}/assistants`;
      const getTrusteeAssistantsSpy = vi
        .spyOn(TrusteeAssistantsUseCase.prototype, 'getTrusteeAssistants')
        .mockResolvedValue([]);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual([]);
      expect(getTrusteeAssistantsSpy).toHaveBeenCalledWith(context, trusteeId);
    });

    test('should return 400 when trusteeId is missing', async () => {
      context.request.params = {};

      await expect(controller.handleRequest(context)).rejects.toThrow('Trustee ID is required');
    });

    test('should propagate use case errors', async () => {
      const trusteeId = 'trustee-123';
      context.request.params['trusteeId'] = trusteeId;
      vi.spyOn(TrusteeAssistantsUseCase.prototype, 'getTrusteeAssistants').mockRejectedValue(
        new Error('Trustee not found'),
      );

      await expect(controller.handleRequest(context)).rejects.toThrow();
    });
  });

  describe('GET /api/trustees/:trusteeId/assistants/:assistantId', () => {
    beforeEach(() => {
      context.request.method = 'GET';
    });

    test('should return single assistant by ID', async () => {
      const trusteeId = 'trustee-123';
      const assistantId = 'assistant-456';
      const assistant = MockData.getTrusteeAssistant({ id: assistantId, trusteeId });

      context.request.params['trusteeId'] = trusteeId;
      context.request.params['assistantId'] = assistantId;
      context.request.url = `/api/trustees/${trusteeId}/assistants/${assistantId}`;
      const getAssistantSpy = vi
        .spyOn(TrusteeAssistantsUseCase.prototype, 'getAssistant')
        .mockResolvedValue(assistant);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual(assistant);
      expect(result.body?.meta).toEqual({
        self: `/api/trustees/${trusteeId}/assistants/${assistantId}`,
      });
      expect(getAssistantSpy).toHaveBeenCalledWith(context, trusteeId, assistantId);
    });

    test('should return list when assistantId is missing', async () => {
      const trusteeId = 'trustee-123';
      const assistants = [MockData.getTrusteeAssistant({ trusteeId })];
      context.request.params = { trusteeId };
      context.request.url = `/api/trustees/${trusteeId}/assistants`;
      const getTrusteeAssistantsSpy = vi
        .spyOn(TrusteeAssistantsUseCase.prototype, 'getTrusteeAssistants')
        .mockResolvedValue(assistants);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual(assistants);
      expect(getTrusteeAssistantsSpy).toHaveBeenCalledWith(context, trusteeId);
    });

    test('should propagate use case errors when assistant not found', async () => {
      const trusteeId = 'trustee-123';
      const assistantId = 'non-existent';
      context.request.params['trusteeId'] = trusteeId;
      context.request.params['assistantId'] = assistantId;
      vi.spyOn(TrusteeAssistantsUseCase.prototype, 'getAssistant').mockRejectedValue(
        new Error('Assistant not found'),
      );

      await expect(controller.handleRequest(context)).rejects.toThrow();
    });
  });

  describe('POST /api/trustees/:trusteeId/assistants', () => {
    beforeEach(() => {
      context.request.method = 'POST';
    });

    test('should create a new assistant for a trustee', async () => {
      const trusteeId = 'trustee-123';
      const createdAssistant = {
        ...assistantInput,
        id: 'assistant-456',
        trusteeId,
        updatedBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2024-01-01T00:00:00Z',
      };

      context.request.params = { trusteeId };
      context.request.body = assistantInput;
      context.request.url = `/api/trustees/${trusteeId}/assistants`;
      const createAssistantSpy = vi
        .spyOn(TrusteeAssistantsUseCase.prototype, 'createAssistant')
        .mockResolvedValue(createdAssistant);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(201);
      expect(result.body?.meta?.self).toBe(
        `/api/trustees/${trusteeId}/assistants/${createdAssistant.id}`,
      );
      expect(createAssistantSpy).toHaveBeenCalledWith(context, trusteeId, assistantInput);
    });

    test('should throw error when trusteeId is not provided', async () => {
      context.request.params = {};
      context.request.body = assistantInput;

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
      context.request.body = assistantInput;
      vi.spyOn(TrusteeAssistantsUseCase.prototype, 'createAssistant').mockRejectedValue(
        new Error('Validation failed'),
      );

      await expect(controller.handleRequest(context)).rejects.toThrow();
    });
  });

  describe('PUT /api/trustees/:trusteeId/assistants/:assistantId', () => {
    beforeEach(() => {
      context.request.method = 'PUT';
    });

    test('should update an existing assistant', async () => {
      const trusteeId = 'trustee-123';
      const assistantId = 'assistant-456';
      const updatedAssistant = {
        ...assistantInput,
        id: assistantId,
        trusteeId,
        updatedBy: SYSTEM_USER_REFERENCE,
        updatedOn: '2024-01-02T00:00:00Z',
      };

      context.request.params = { trusteeId, assistantId };
      context.request.body = assistantInput;
      context.request.url = `/api/trustees/${trusteeId}/assistants/${assistantId}`;
      const updateAssistantSpy = vi
        .spyOn(TrusteeAssistantsUseCase.prototype, 'updateAssistant')
        .mockResolvedValue(updatedAssistant);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.meta?.self).toBe(`/api/trustees/${trusteeId}/assistants/${assistantId}`);
      expect(updateAssistantSpy).toHaveBeenCalledWith(
        context,
        trusteeId,
        assistantId,
        assistantInput,
      );
    });

    test('should throw error when trusteeId is not provided', async () => {
      context.request.params = { assistantId: 'assistant-456' };
      context.request.body = assistantInput;

      await expect(controller.handleRequest(context)).rejects.toThrow('Trustee ID is required');
    });

    test('should throw error when assistantId is not provided', async () => {
      context.request.params = { trusteeId: 'trustee-123' };
      context.request.body = assistantInput;

      await expect(controller.handleRequest(context)).rejects.toThrow('Assistant ID is required');
    });

    test('should throw error when request body is missing', async () => {
      context.request.params = { trusteeId: 'trustee-123', assistantId: 'assistant-456' };
      context.request.body = undefined;

      await expect(controller.handleRequest(context)).rejects.toThrow('Request body is required');
    });

    test('should propagate use case validation errors', async () => {
      const trusteeId = 'trustee-123';
      const assistantId = 'assistant-456';
      context.request.params = { trusteeId, assistantId };
      context.request.body = assistantInput;
      vi.spyOn(TrusteeAssistantsUseCase.prototype, 'updateAssistant').mockRejectedValue(
        new Error('Validation failed'),
      );

      await expect(controller.handleRequest(context)).rejects.toThrow();
    });
  });

  describe('DELETE /api/trustees/:trusteeId/assistants/:assistantId', () => {
    beforeEach(() => {
      context.request.method = 'DELETE';
    });

    test('should delete an assistant and return 204', async () => {
      const trusteeId = 'trustee-123';
      const assistantId = 'assistant-456';

      context.request.params = { trusteeId, assistantId };
      context.request.url = `/api/trustees/${trusteeId}/assistants/${assistantId}`;
      const deleteAssistantSpy = vi
        .spyOn(TrusteeAssistantsUseCase.prototype, 'deleteAssistant')
        .mockResolvedValue(undefined);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(204);
      expect(deleteAssistantSpy).toHaveBeenCalledWith(context, trusteeId, assistantId);
    });

    test('should throw error when trusteeId is not provided', async () => {
      context.request.params = { assistantId: 'assistant-456' };

      await expect(controller.handleRequest(context)).rejects.toThrow('Trustee ID is required');
    });

    test('should throw error when assistantId is not provided', async () => {
      context.request.params = { trusteeId: 'trustee-123' };

      await expect(controller.handleRequest(context)).rejects.toThrow('Assistant ID is required');
    });

    test('should propagate use case errors', async () => {
      const trusteeId = 'trustee-123';
      const assistantId = 'assistant-456';
      context.request.params = { trusteeId, assistantId };
      vi.spyOn(TrusteeAssistantsUseCase.prototype, 'deleteAssistant').mockRejectedValue(
        new Error('Assistant not found'),
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
