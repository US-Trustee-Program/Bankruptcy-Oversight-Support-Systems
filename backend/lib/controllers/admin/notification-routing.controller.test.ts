import { vi, Mocked } from 'vitest';
import * as dns from 'node:dns/promises';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { NotificationRoutingController } from './notification-routing.controller';
import { CamsRole } from '@common/cams/roles';
import { NotificationRoutingRepository } from '../../use-cases/gateways.types';
import factory from '../../factory';
import { NotificationRoutingRecord } from '@common/cams/notifications';
import HttpStatusCodes from '@common/api/http-status-codes';

vi.mock('../../factory');
vi.mock('node:dns/promises');
const mockFactory = factory as Mocked<typeof factory>;

function notFoundError(): NodeJS.ErrnoException {
  const error = new Error('queryA ENOTFOUND') as NodeJS.ErrnoException;
  error.code = 'ENOTFOUND';
  return error;
}

function timeoutError(): NodeJS.ErrnoException {
  const error = new Error('queryMx ETIMEOUT') as NodeJS.ErrnoException;
  error.code = 'ETIMEOUT';
  return error;
}

describe('NotificationRoutingController', () => {
  let context: ApplicationContext;
  let controller: NotificationRoutingController;
  let mockRepo: Mocked<NotificationRoutingRepository>;

  const mockRecord: NotificationRoutingRecord = {
    id: 'chapter-7-oversight',
    covers: ['chapter:7'],
    recipientAddresses: ['test@example.com'],
    displayName: 'Chapter 7 Oversight',
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

    vi.mocked(dns.resolveMx)
      .mockReset()
      .mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);
    vi.mocked(dns.resolve).mockReset().mockResolvedValue(['1.2.3.4']);

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
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = { recipientAddresses: ['updated@example.com'] };
      const updatedRecord = { ...mockRecord, recipientAddresses: ['updated@example.com'] };
      mockRepo.updateRoutingRecord.mockResolvedValue(updatedRecord);

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.OK);
      expect(result.body.data).toEqual(updatedRecord);
      expect(mockRepo.updateRoutingRecord).toHaveBeenCalledWith('chapter-7-oversight', {
        recipientAddresses: ['updated@example.com'],
      });
      expect(mockRepo.createRoutingAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'AUDIT_NOTIFICATION_ROUTING',
          routingRecordId: 'chapter-7-oversight',
          before: '',
          after: 'updated@example.com',
        }),
      );
    });

    test('should capture prior addresses in audit before field when record already exists', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = { recipientAddresses: ['updated@example.com'] };
      mockRepo.findRecipientByRoutingKey.mockResolvedValue({
        ...mockRecord,
        recipientAddresses: ['original@example.com', 'backup@example.com'],
      });
      mockRepo.updateRoutingRecord.mockResolvedValue({
        ...mockRecord,
        recipientAddresses: ['updated@example.com'],
      });

      await controller.handleRequest(context);

      expect(mockRepo.createRoutingAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          before: 'original@example.com, backup@example.com',
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
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = {};

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
      );
    });

    test('should allow clearing all recipients by passing an empty array', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = { recipientAddresses: [] };
      mockRepo.updateRoutingRecord.mockResolvedValue({ ...mockRecord, recipientAddresses: [] });

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.OK);
      expect(mockRepo.updateRoutingRecord).toHaveBeenCalledWith('chapter-7-oversight', {
        recipientAddresses: [],
      });
    });

    test('should throw BadRequestError when any address in recipientAddresses is invalid', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = { recipientAddresses: ['valid@example.com', 'not-an-email'] };

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
      );
    });

    test('should throw BadRequestError when body is null', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = null;

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
      );
    });

    test('should throw BadRequestError when recipientAddresses is a non-array value', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = { recipientAddresses: 'not-an-array' };

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
      );
    });

    test('should throw BadRequestError when recipientAddresses contains non-string values', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = { recipientAddresses: [1, null, {}] };

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
      );
    });

    test('should throw BadRequestError when recipientAddresses mixes valid strings and non-strings', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = { recipientAddresses: ['valid@example.com', 42] };

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
      );
    });
  });

  describe('handlePut domain validation', () => {
    test('should throw BadRequestError when a domain has neither MX nor A records', async () => {
      vi.mocked(dns.resolveMx).mockRejectedValue(notFoundError());
      vi.mocked(dns.resolve).mockRejectedValue(notFoundError());
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = { recipientAddresses: ['someone@UST.DOJ.GOV'] };

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
      );
      expect(mockRepo.updateRoutingRecord).not.toHaveBeenCalled();
    });

    test('should fall back to an A-record lookup when a domain has no MX records', async () => {
      vi.mocked(dns.resolveMx).mockRejectedValue(notFoundError());
      vi.mocked(dns.resolve).mockResolvedValue(['1.2.3.4']);
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = { recipientAddresses: ['someone@usdoj.gov'] };
      mockRepo.updateRoutingRecord.mockResolvedValue({
        ...mockRecord,
        recipientAddresses: ['someone@usdoj.gov'],
      });

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.OK);
      expect(mockRepo.updateRoutingRecord).toHaveBeenCalledWith('chapter-7-oversight', {
        recipientAddresses: ['someone@usdoj.gov'],
      });
    });

    test('should save and return a warning when the DNS lookup is indeterminate rather than confirming the domain is missing', async () => {
      vi.mocked(dns.resolveMx).mockRejectedValue(timeoutError());
      vi.mocked(dns.resolve).mockRejectedValue(timeoutError());
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = { recipientAddresses: ['someone@usdoj.gov'] };
      mockRepo.updateRoutingRecord.mockResolvedValue({
        ...mockRecord,
        recipientAddresses: ['someone@usdoj.gov'],
      });

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.OK);
      expect(mockRepo.updateRoutingRecord).toHaveBeenCalledWith('chapter-7-oversight', {
        recipientAddresses: ['someone@usdoj.gov'],
      });
      expect(result.body.warnings).toEqual([expect.stringContaining("'usdoj.gov'")]);
    });

    test('should not include a warnings field on the response when domain validation succeeds cleanly', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = { recipientAddresses: ['someone@usdoj.gov'] };
      mockRepo.updateRoutingRecord.mockResolvedValue({
        ...mockRecord,
        recipientAddresses: ['someone@usdoj.gov'],
      });

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.OK);
      expect(result.body.warnings).toBeUndefined();
    });

    test('should only check each unique domain once across multiple recipient addresses', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = {
        recipientAddresses: ['first@usdoj.gov', 'second@usdoj.gov'],
      };
      mockRepo.updateRoutingRecord.mockResolvedValue({
        ...mockRecord,
        recipientAddresses: ['first@usdoj.gov', 'second@usdoj.gov'],
      });

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.OK);
      expect(dns.resolveMx).toHaveBeenCalledTimes(1);
      expect(dns.resolveMx).toHaveBeenCalledWith('usdoj.gov');
    });
  });
});
