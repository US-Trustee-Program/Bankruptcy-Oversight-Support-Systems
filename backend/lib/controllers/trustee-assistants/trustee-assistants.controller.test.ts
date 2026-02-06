import { vi, type Mocked, type MockedClass } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAssistantsController } from './trustee-assistants.controller';
import { TrusteeAssistantsUseCase } from '../../use-cases/trustee-assistants/trustee-assistants';
import { CamsUserReference } from '@common/cams/users';
import { CamsRole } from '@common/cams/roles';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeAssistantInput } from '@common/cams/trustee-assistants';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

// Mock the use case
import MockData from '@common/cams/test-utilities/mock-data';

vi.mock('../../use-cases/trustee-assistants/trustee-assistants');

describe('TrusteeAssistantsController', () => {
  let context: ApplicationContext;
  let controller: TrusteeAssistantsController;
  let mockUseCase: Mocked<TrusteeAssistantsUseCase>;

  const mockUser: CamsUserReference = {
    id: 'user123',
    name: 'Test User',
  };

  const sampleAssistant = MockData.getTrusteeAssistant();

  beforeEach(async () => {
    context = await createMockApplicationContext();
    context.session.user = { ...mockUser, roles: [CamsRole.TrusteeAdmin] };

    if (!context.featureFlags) {
      context.featureFlags = {};
    }

    mockUseCase = {
      getTrusteeAssistants: vi.fn(),
      createAssistant: vi.fn(),
    } as unknown as Mocked<TrusteeAssistantsUseCase>;

    (TrusteeAssistantsUseCase as MockedClass<typeof TrusteeAssistantsUseCase>).mockImplementation(
      () => mockUseCase,
    );

    controller = new TrusteeAssistantsController(context);
    context.featureFlags['trustee-management'] = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/trustees/:trusteeId/assistants', () => {
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
      mockUseCase.createAssistant.mockResolvedValue(createdAssistant);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(201);
      expect(result.body?.meta?.self).toBe(`${context.request.url}/${createdAssistant.id}`);
      expect(mockUseCase.createAssistant).toHaveBeenCalledWith(context, trusteeId, assistantInput);
    });

    test('should throw error when trusteeId is not provided', async () => {
      context.request.body = assistantInput;
      await expect(controller.handleRequest(context)).rejects.toThrow('Trustee ID is required');
    });
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
      mockUseCase.getTrusteeAssistants.mockResolvedValue([sampleAssistant]);

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
      mockUseCase.getTrusteeAssistants.mockResolvedValue([assistant1, assistant2]);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual([assistant1, assistant2]);
      expect(result.body?.meta).toEqual({
        self: `/api/trustees/${trusteeId}/assistants`,
      });
      expect(mockUseCase.getTrusteeAssistants).toHaveBeenCalledWith(context, trusteeId);
    });

    test('should return empty array when trustee has no assistants', async () => {
      const trusteeId = 'trustee-456';

      context.request.params['trusteeId'] = trusteeId;
      context.request.url = `/api/trustees/${trusteeId}/assistants`;
      mockUseCase.getTrusteeAssistants.mockResolvedValue([]);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual([]);
      expect(mockUseCase.getTrusteeAssistants).toHaveBeenCalledWith(context, trusteeId);
    });

    test('should return 400 when trusteeId is missing', async () => {
      context.request.params = {};

      await expect(controller.handleRequest(context)).rejects.toThrow('Trustee ID is required');
    });

    test('should throw error when request body is missing', async () => {
      context.request.params = { trusteeId: 'trustee-123' };

      await expect(controller.handleRequest(context)).rejects.toThrow('Request body is required');
    });

    test('should return 201 with correct location', async () => {
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
      mockUseCase.createAssistant.mockResolvedValue(createdAssistant);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(201);
      expect(result.body?.meta?.self).toBe(
        `/api/trustees/${trusteeId}/assistants/${createdAssistant.id}`
      );
    });

    test('should propagate use case errors', async () => {
      const trusteeId = 'trustee-123';
      context.request.params['trusteeId'] = trusteeId;
      mockUseCase.getTrusteeAssistants.mockRejectedValue(new Error('Trustee not found'));

      await expect(controller.handleRequest(context)).rejects.toThrow();
    });
  });

  describe('Unsupported HTTP methods', () => {
    test('should return BadRequestError for POST method', async () => {
      context.request.method = 'POST';
      context.request.params['trusteeId'] = 'trustee-123';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'HTTP method POST is not supported',
      );
    });

    test('should return BadRequestError for PUT method', async () => {
      context.request.method = 'PUT';
      context.request.params['trusteeId'] = 'trustee-123';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'HTTP method PUT is not supported',
      );
    });

    test('should return BadRequestError for DELETE method', async () => {
      context.request.method = 'DELETE';
      context.request.params['trusteeId'] = 'trustee-123';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'HTTP method DELETE is not supported',
      );
    });
  });
});
