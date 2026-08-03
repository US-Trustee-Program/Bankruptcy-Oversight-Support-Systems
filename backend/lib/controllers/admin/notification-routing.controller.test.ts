import { vi, Mocked } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { NotificationRoutingController } from './notification-routing.controller';
import { CamsRole } from '@common/cams/roles';
import {
  DomainVerificationGateway,
  NotificationRoutingRepository,
} from '../../use-cases/gateways.types';
import factory from '../../factory';
import { NotificationRoutingRecord } from '@common/cams/notifications';
import HttpStatusCodes from '@common/api/http-status-codes';

describe('NotificationRoutingController', () => {
  let context: ApplicationContext;
  let controller: NotificationRoutingController;
  let mockRepo: Mocked<NotificationRoutingRepository>;
  let mockDomainVerificationGateway: Mocked<DomainVerificationGateway>;

  const mockRecord: NotificationRoutingRecord = {
    id: 'chapter-7-oversight',
    covers: ['chapter:7'],
    recipientAddresses: ['test@example.com'],
    displayName: 'Chapter 7 Oversight',
    documentType: 'NOTIFICATION_ROUTING',
  };

  beforeEach(async () => {
    vi.restoreAllMocks();

    mockRepo = {
      getAll: vi.fn(),
      updateRoutingRecord: vi.fn(),
      createRoutingAuditRecord: vi.fn().mockResolvedValue(undefined),
      findRecipientByRoutingKey: vi.fn().mockResolvedValue(null),
      release: vi.fn(),
    } as unknown as Mocked<NotificationRoutingRepository>;

    vi.spyOn(factory, 'getNotificationRoutingRepository').mockReturnValue(mockRepo);

    mockDomainVerificationGateway = {
      verifyMailDomain: vi.fn().mockResolvedValue('valid'),
    } as unknown as Mocked<DomainVerificationGateway>;

    vi.spyOn(factory, 'getDomainVerificationGateway').mockReturnValue(
      mockDomainVerificationGateway,
    );

    context = await createMockApplicationContext();
    context.session.user.roles = [CamsRole.SuperUser];
    controller = new NotificationRoutingController(context);
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

    test.each([
      { description: 'recipientAddresses is missing', body: {} },
      {
        description: 'recipientAddresses contains an invalid address',
        body: { recipientAddresses: ['valid@example.com', 'not-an-email'] },
      },
      { description: 'body is null', body: null },
      {
        description: 'recipientAddresses is a non-array value',
        body: { recipientAddresses: 'not-an-array' },
      },
      {
        description: 'recipientAddresses contains non-string values',
        body: { recipientAddresses: [1, null, {}] },
      },
      {
        description: 'recipientAddresses mixes valid strings and non-strings',
        body: { recipientAddresses: ['valid@example.com', 42] },
      },
    ])('should throw BadRequestError when $description', async ({ body }) => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = body;

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
      );
    });

    test('should trim leading/trailing whitespace from addresses before validating and saving', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = { recipientAddresses: ['  someone@usdoj.gov  '] };
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
  });

  describe('handlePut domain validation', () => {
    test('should throw BadRequestError when a domain is not found', async () => {
      mockDomainVerificationGateway.verifyMailDomain.mockResolvedValue('not-found');
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = { recipientAddresses: ['someone@UST.DOJ.GOV'] };

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatusCodes.BAD_REQUEST,
          message: expect.stringContaining('ust.doj.gov'),
        }),
      );
      expect(mockRepo.updateRoutingRecord).not.toHaveBeenCalled();
    });

    test('should reject on the not-found domain and never surface the indeterminate domain warning when a request mixes both', async () => {
      mockDomainVerificationGateway.verifyMailDomain.mockImplementation(async (domain) =>
        domain === 'ust.doj.gov' ? 'not-found' : 'indeterminate',
      );
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = {
        recipientAddresses: ['someone@UST.DOJ.GOV', 'someone@usdoj.gov'],
      };

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatusCodes.BAD_REQUEST,
          message: expect.stringContaining('ust.doj.gov'),
        }),
      );
      expect(mockRepo.updateRoutingRecord).not.toHaveBeenCalled();
    });

    test('should save when the domain resolves as valid', async () => {
      mockDomainVerificationGateway.verifyMailDomain.mockResolvedValue('valid');
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

    test('should save and return a warning when domain verification is indeterminate rather than confirming the domain is missing', async () => {
      mockDomainVerificationGateway.verifyMailDomain.mockResolvedValue('indeterminate');
      const warnSpy = vi.spyOn(context.logger, 'warn');
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
      expect(warnSpy).toHaveBeenCalledWith(
        'NOTIFICATION-ROUTING-CONTROLLER',
        expect.stringContaining("'usdoj.gov'"),
      );
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
      expect(mockDomainVerificationGateway.verifyMailDomain).toHaveBeenCalledTimes(1);
      expect(mockDomainVerificationGateway.verifyMailDomain).toHaveBeenCalledWith('usdoj.gov');
    });

    test('should verify multiple distinct domains concurrently', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = {
        recipientAddresses: ['first@usdoj.gov', 'second@example.com'],
      };
      mockRepo.updateRoutingRecord.mockResolvedValue({
        ...mockRecord,
        recipientAddresses: ['first@usdoj.gov', 'second@example.com'],
      });

      const result = await controller.handleRequest(context);

      expect(result.statusCode).toBe(HttpStatusCodes.OK);
      expect(mockDomainVerificationGateway.verifyMailDomain).toHaveBeenCalledTimes(2);
      expect(mockDomainVerificationGateway.verifyMailDomain).toHaveBeenCalledWith('usdoj.gov');
      expect(mockDomainVerificationGateway.verifyMailDomain).toHaveBeenCalledWith('example.com');
    });

    test('should reject the request when recipientAddresses exceeds the maximum length', async () => {
      context.request.method = 'PUT';
      context.request.params = { routingId: 'chapter-7-oversight' };
      context.request.body = {
        recipientAddresses: Array.from({ length: 51 }, (_, i) => `person${i}@usdoj.gov`),
      };

      await expect(controller.handleRequest(context)).rejects.toThrow(
        expect.objectContaining({ status: HttpStatusCodes.BAD_REQUEST }),
      );
      expect(mockDomainVerificationGateway.verifyMailDomain).not.toHaveBeenCalled();
      expect(mockRepo.updateRoutingRecord).not.toHaveBeenCalled();
    });
  });
});
