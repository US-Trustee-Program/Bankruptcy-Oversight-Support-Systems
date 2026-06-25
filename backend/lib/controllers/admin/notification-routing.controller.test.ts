import { vi, Mocked } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { NotificationRoutingController } from './notification-routing.controller';
import { CamsRole } from '@common/cams/roles';
import { NotificationRoutingRepository } from '../../use-cases/gateways.types';
import factory from '../../factory';
import { NotificationRoutingRecord, NotificationConfig } from '@common/cams/notifications';
import HttpStatusCodes from '@common/api/http-status-codes';

vi.mock('../../factory');
const mockFactory = factory as Mocked<typeof factory>;

describe('NotificationRoutingController', () => {
  let context: ApplicationContext;
  let controller: NotificationRoutingController;
  let mockRepo: Mocked<NotificationRoutingRepository>;

  const mockRecord: NotificationRoutingRecord = {
    id: 'default-chapter-oversight',
    covers: ['chapter:7', 'chapter:11', 'chapter:12', 'chapter:13'],
    recipientAddress: 'test@example.com',
    displayName: 'Default Chapter Oversight',
    documentType: 'NOTIFICATION_ROUTING',
  };

  const mockConfig: NotificationConfig = { enabled: true };

  beforeEach(async () => {
    mockRepo = {
      getAll: vi.fn(),
      updateRoutingRecord: vi.fn(),
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      findRecipientByRoutingKey: vi.fn(),
      release: vi.fn(),
    } as unknown as Mocked<NotificationRoutingRepository>;

    mockFactory.getNotificationRoutingRepository = vi.fn().mockReturnValue(mockRepo);

    context = await createMockApplicationContext();
    context.session.user.roles = [CamsRole.SuperUser];
    controller = new NotificationRoutingController(context);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('authorization', () => {
    test('should throw ForbiddenError when user lacks SuperUser role', async () => {
      context.session.user.roles = [CamsRole.TrialAttorney];
      context.request.method = 'GET';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.FORBIDDEN }),
      );
    });

    test('should throw ForbiddenError when user has no roles', async () => {
      context.session.user.roles = [];
      context.request.method = 'GET';

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.FORBIDDEN }),
      );
    });
  });

  describe('handleRequest routing', () => {
    test('should route GET with no params to list all routing records', async () => {
      context.request.method = 'GET';
      mockRepo.getAll.mockResolvedValue([mockRecord]);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.OK);
      expect(result.body.data).toEqual([mockRecord]);
      expect(mockRepo.getAll).toHaveBeenCalled();
    });

    test('should route GET with config param to get config', async () => {
      context.request.method = 'GET';
      context.request.params = { routingId: 'config' };
      mockRepo.getConfig.mockResolvedValue(mockConfig);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.OK);
      expect(result.body.data).toEqual(mockConfig);
      expect(mockRepo.getConfig).toHaveBeenCalled();
    });

    test('should route PUT with routingId to update a routing record', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'default-chapter-oversight' };
      context.request.body = { recipientAddress: 'updated@example.com' };
      mockRepo.updateRoutingRecord.mockResolvedValue({
        ...mockRecord,
        recipientAddress: 'updated@example.com',
      });

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.OK);
      expect(mockRepo.updateRoutingRecord).toHaveBeenCalledWith('default-chapter-oversight', {
        recipientAddress: 'updated@example.com',
      });
    });

    test('should route PUT with config param to update config', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'config' };
      context.request.body = { enabled: false };
      mockRepo.updateConfig.mockResolvedValue({ enabled: false });

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.OK);
      expect(result.body.data).toEqual({ enabled: false });
      expect(mockRepo.updateConfig).toHaveBeenCalledWith({ enabled: false });
    });

    test('should return METHOD_NOT_ALLOWED for POST', async () => {
      context.request.method = 'POST';

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.METHOD_NOT_ALLOWED);
    });

    test('should return METHOD_NOT_ALLOWED for DELETE', async () => {
      context.request.method = 'DELETE';
      context.request.params = { routingId: 'some-id' };

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.METHOD_NOT_ALLOWED);
    });

    test('should return METHOD_NOT_ALLOWED for unsupported methods', async () => {
      context.request.method = 'PATCH';

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.METHOD_NOT_ALLOWED);
    });
  });

  describe('handlePut validation', () => {
    test('should throw BadRequestError when recipientAddress is missing', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'default-chapter-oversight' };
      context.request.body = {};

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
      );
    });

    test('should throw BadRequestError when recipientAddress is invalid', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'default-chapter-oversight' };
      context.request.body = { recipientAddress: 'not-an-email' };

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
      );
    });

    test('should throw BadRequestError when body is null', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'default-chapter-oversight' };
      context.request.body = null;

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
      );
    });
  });

  describe('handlePutConfig validation', () => {
    test('should throw BadRequestError when enabled is not a boolean', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'config' };
      context.request.body = { enabled: 'yes' };

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
      );
    });

    test('should throw BadRequestError when body is null for config update', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'config' };
      context.request.body = null;

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
      );
    });
  });
});
