import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteesController } from './trustees.controller';
import { TrusteesUseCase } from '../../use-cases/trustees/trustees';
import { TrusteeInput } from '@common/cams/trustees';
import { TrusteeDocument } from '../../adapters/gateways/mongo/trustees.mongo.repository';
import { CamsUserReference } from '@common/cams/users';
import { CamsRole } from '@common/cams/roles';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { NotFoundError } from '../../common-errors/not-found-error';
import { BadRequestError } from '../../common-errors/bad-request';

// Mock the use case
vi.mock('../../use-cases/trustees/trustees');

describe('TrusteesController', () => {
  let context: ApplicationContext;
  let controller: TrusteesController;
  let mockUseCase: vi.Mocked<TrusteesUseCase>;

  const mockUser: CamsUserReference = {
    id: 'user123',
    name: 'Test User',
  };

  const sampleTrustee: TrusteeInput = {
    name: 'John Doe',
    public: {
      address: {
        address1: '123 Main St',
        city: 'Anytown',
        state: 'NY',
        zipCode: '12345',
        countryCode: 'US',
      },
      phone: {
        number: '555-0123',
      },
      email: 'john.doe@example.com',
    },
  };

  const sampleTrusteeDocument: TrusteeDocument = {
    ...sampleTrustee,
    id: 'trustee-123',
    trusteeId: 'trustee-123',
    documentType: 'TRUSTEE',
    createdOn: '2025-08-12T10:00:00Z',
    createdBy: mockUser,
    updatedOn: '2025-08-12T10:00:00Z',
    updatedBy: mockUser,
  };

  beforeEach(async () => {
    context = await createMockApplicationContext();
    context.session.user = { ...mockUser, roles: [CamsRole.TrusteeAdmin] };

    // Initialize featureFlags if it doesn't exist
    if (!context.featureFlags) {
      context.featureFlags = {};
    }

    mockUseCase = {
      createTrustee: vi.fn(),
      listTrustees: vi.fn(),
      getTrustee: vi.fn(),
      updateTrustee: vi.fn(),
    } as unknown as vi.Mocked<TrusteesUseCase>;

    (TrusteesUseCase as vi.MockedClass<typeof TrusteesUseCase>).mockImplementation(function (
      this: TrusteesUseCase,
    ) {
      return mockUseCase;
    });

    controller = new TrusteesController(context);

    // Mock feature flag to be enabled by default
    context.featureFlags['trustee-management'] = true;
  });

  describe('Feature flag protection', () => {
    test('should return 404 when trustee-management feature is disabled', async () => {
      context.featureFlags['trustee-management'] = false;
      context.request.method = 'POST';

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(404);
    });

    test('should proceed when trustee-management feature is enabled', async () => {
      context.featureFlags['trustee-management'] = true;
      context.request.method = 'POST';
      context.request.body = sampleTrustee;
      mockUseCase.createTrustee.mockResolvedValue(sampleTrusteeDocument);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(201);
    });
  });

  describe('Role-based authorization', () => {
    test('should allow access for users with TrusteeAdmin role', async () => {
      context.request.method = 'POST';
      context.request.body = sampleTrustee;
      mockUseCase.createTrustee.mockResolvedValue(sampleTrusteeDocument);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(201);
    });

    test('should deny access for users without TrusteeAdmin role', async () => {
      context.session.user.roles = [CamsRole.TrialAttorney]; // Different role
      context.request.method = 'POST';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'User does not have permission to manage trustees',
      );
    });

    test('should deny access for users with no roles', async () => {
      context.session.user.roles = [];
      context.request.method = 'POST';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'User does not have permission to manage trustees',
      );
    });

    test('should deny access for users with undefined roles', async () => {
      delete context.session.user.roles;
      context.request.method = 'POST';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'User does not have permission to manage trustees',
      );
    });

    test('should deny access when session.user is undefined', async () => {
      delete context.session.user;
      context.request.method = 'POST';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'User does not have permission to manage trustees',
      );
    });

    test('should deny access when session is undefined', async () => {
      delete context.session;
      context.request.method = 'POST';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'User does not have permission to manage trustees',
      );
    });
  });

  describe('POST /api/trustees', () => {
    beforeEach(() => {
      context.request.method = 'POST';
    });

    test('should create trustee successfully', async () => {
      context.request.body = sampleTrustee;
      context.request.url = '/api/trustees';
      mockUseCase.createTrustee.mockResolvedValue(sampleTrusteeDocument);

      const result = await controller.handleRequest(context);

      expect(mockUseCase.createTrustee).toHaveBeenCalledWith(context, sampleTrustee);
      expect(result.statusCode).toBe(201);
      expect(result.body).toEqual({
        meta: {
          self: '/api/trustees/trustee-123',
        },
        data: sampleTrusteeDocument,
      });
    });

    test('should return 400 when request body is missing', async () => {
      context.request.body = null;

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'Request body is required for trustee creation',
      );
    });

    test('should handle use case validation errors', async () => {
      context.request.body = { ...sampleTrustee, name: '' };
      mockUseCase.createTrustee.mockRejectedValue(
        new Error('Trustee validation failed: Trustee name is required'),
      );

      await expect(controller.handleRequest(context)).rejects.toThrow();
    });
  });

  describe('GET /api/trustees', () => {
    beforeEach(() => {
      context.request.method = 'GET';
    });

    test('should return list of trustees for GET requests', async () => {
      const mockTrustees = [sampleTrusteeDocument];
      mockUseCase.listTrustees.mockResolvedValue(mockTrustees);
      context.request.url = '/api/trustees';

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual(mockTrustees);
      expect(mockUseCase.listTrustees).toHaveBeenCalledWith(context);
    });
  });

  describe('GET /api/trustees/:id', () => {
    beforeEach(() => {
      context.request.method = 'GET';
    });

    test('should return individual trustee for GET requests with ID', async () => {
      const id = 'trustee-123';
      mockUseCase.getTrustee.mockResolvedValue(sampleTrusteeDocument);

      context.request.params['id'] = id;
      context.request.url = `/api/trustees/${id}`;

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(200);
      expect(result.body?.data).toEqual(sampleTrusteeDocument);
      expect(mockUseCase.getTrustee).toHaveBeenCalledWith(context, id);
    });

    test('should handle trustee not found errors', async () => {
      const id = 'nonexistent-id';
      mockUseCase.getTrustee.mockRejectedValue(
        new Error('Trustee with ID nonexistent-id not found.'),
      );
      context.request.params['id'] = id;
      context.request.url = `/api/trustees/${id}`;

      await expect(controller.handleRequest(context)).rejects.toThrow('Unknown Error');
    });
  });

  describe('PATCH /api/trustees/:id', () => {
    beforeEach(() => {
      context.request.method = 'PATCH';
    });

    test('should update trustee successfully', async () => {
      const id = 'trustee-123';
      context.request.params['id'] = id;
      context.request.url = `/api/trustees/${id}`;
      context.request.body = { name: 'John Smith' }; // Update name
      mockUseCase.updateTrustee.mockResolvedValue(sampleTrusteeDocument);

      const result = await controller.handleRequest(context);

      expect(mockUseCase.updateTrustee).toHaveBeenCalledWith(context, id, context.request.body);
      expect(result.statusCode).toBe(200);
      expect(result.body).toEqual({
        meta: {
          self: '/api/trustees/trustee-123',
        },
        data: sampleTrusteeDocument,
      });
    });

    test('should throw NotFoundError when trustee to update is not found', async () => {
      const id = 'nonexistent-id';
      context.request.params['id'] = id;
      context.request.url = `/api/trustees/${id}`;
      context.request.body = { name: 'John Smith' };
      mockUseCase.updateTrustee.mockRejectedValue(
        new NotFoundError('Trustee with ID nonexistent-id not found.'),
      );

      await expect(controller.handleRequest(context)).rejects.toThrow('Not found');
    });

    test('should handle validation errors', async () => {
      const id = 'trustee-123';
      context.request.params['id'] = id;
      context.request.url = `/api/trustees/${id}`;
      context.request.body = { name: '' }; // Invalid name
      mockUseCase.updateTrustee.mockRejectedValue(
        new Error('Trustee validation failed: Trustee name is required'),
      );

      await expect(controller.handleRequest(context)).rejects.toThrow();
    });

    test('should handle bad request errors', async () => {
      const id = 'trustee-123';
      context.request.params['id'] = id;
      context.request.url = `/api/trustees/${id}`;
      mockUseCase.updateTrustee.mockRejectedValue(
        new Error('Request body is required for trustee update'),
      );
      await expect(controller.handleRequest(context)).rejects.toThrow(BadRequestError);
    });
  });

  describe('Error handling', () => {
    test('should reject unsupported HTTP methods', async () => {
      context.request.method = 'PUT';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        'HTTP method PUT is not supported',
      );
    });
  });
});
