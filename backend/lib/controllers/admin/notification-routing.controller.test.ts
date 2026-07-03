import { vi, Mocked } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { NotificationRoutingController } from './notification-routing.controller';
import { CamsRole } from '@common/cams/roles';
import { NotificationRoutingRepository } from '../../use-cases/gateways.types';
import factory from '../../factory';
import { NotificationRoutingRecord } from '@common/cams/notifications';
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
    recipientAddresses: ['test@example.com'],
    displayName: 'Default Chapter Oversight',
    documentType: 'NOTIFICATION_ROUTING',
  };

  beforeEach(async () => {
    mockRepo = {
      getAll: vi.fn(),
      updateRoutingRecord: vi.fn(),
      createRoutingAuditRecord: vi.fn().mockResolvedValue(undefined),
      findRecipientByRoutingKey: vi.fn().mockResolvedValue(null),
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

    test('should route PUT with routingId to update a routing record', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'default-chapter-oversight' };
      context.request.body = { recipientAddresses: ['updated@example.com'] };
      mockRepo.updateRoutingRecord.mockResolvedValue({
        ...mockRecord,
        recipientAddresses: ['updated@example.com'],
      });

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.OK);
      expect(mockRepo.updateRoutingRecord).toHaveBeenCalledWith('default-chapter-oversight', {
        recipientAddresses: ['updated@example.com'],
      });
      expect(mockRepo.createRoutingAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_NOTIFICATION_ROUTING',
          routingRecordId: 'default-chapter-oversight',
          before: '',
          after: 'updated@example.com',
        }),
      );
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
    test('should throw BadRequestError when routingId is unknown', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'unknown-id' };
      context.request.body = { recipientAddresses: ['test@example.com'] };

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
      );
    });

    test('should return METHOD_NOT_ALLOWED for PUT without routingId', async () => {
      context.request.method = 'PUT';
      context.request.params = {};

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.METHOD_NOT_ALLOWED);
    });

    test('should throw BadRequestError when recipientAddresses is missing', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'default-chapter-oversight' };
      context.request.body = {};

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
      );
    });

    test('should throw BadRequestError when recipientAddresses is empty array', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'default-chapter-oversight' };
      context.request.body = { recipientAddresses: [] };

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
      );
    });

    test('should throw BadRequestError when any address in recipientAddresses is invalid', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'default-chapter-oversight' };
      context.request.body = { recipientAddresses: ['valid@example.com', 'not-an-email'] };

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
});
