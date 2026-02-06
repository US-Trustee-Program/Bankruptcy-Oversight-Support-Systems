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
vi.mock('../../use-cases/trustee-assistants/trustee-assistants');

describe('TrusteeAssistantsController', () => {
  let context: ApplicationContext;
  let controller: TrusteeAssistantsController;
  let mockUseCase: Mocked<TrusteeAssistantsUseCase>;

  const mockUser: CamsUserReference = {
    id: 'user123',
    name: 'Test User',
  };

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
        `/api/trustees/${trusteeId}/assistants/${createdAssistant.id}`,
      );
    });
  });
});
