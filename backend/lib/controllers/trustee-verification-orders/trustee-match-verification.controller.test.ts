import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { TrusteeMatchVerificationController } from './trustee-match-verification.controller';
import { TrusteeVerificationOrdersUseCase } from '../../use-cases/trustee-verification-orders/trustee-verification-orders.use-case';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { BadRequestError } from '../../common-errors/bad-request';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import factory from '../../factory';

vi.mock('../../deferrable/finalize-deferrable');

const sampleVerification: TrusteeMatchVerification = {
  id: 'verification-1',
  documentType: 'TRUSTEE_MATCH_VERIFICATION',
  caseId: 'case-001',
  courtId: '081',
  dxtrTrustee: { fullName: 'John Doe' },
  mismatchReason: 'IMPERFECT_MATCH',
  matchCandidates: [],
  orderType: 'trustee-match',
  status: 'pending',
  createdOn: '2025-01-01T00:00:00.000Z',
  updatedOn: '2025-01-01T00:00:00.000Z',
  updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
};

describe('TrusteeMatchVerificationController', () => {
  let context;
  let controller: TrusteeMatchVerificationController;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    controller = new TrusteeMatchVerificationController(context);

    vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        search: vi.fn().mockResolvedValue([sampleVerification]),
      }),
    );
    vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        read: vi.fn().mockResolvedValue({
          public: { address: undefined, phone: undefined, email: undefined },
        }),
      }),
    );
    vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        getTrusteeAppointments: vi.fn().mockResolvedValue([]),
        getActiveCaseAppointment: vi.fn().mockResolvedValue(null),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET', () => {
    test('should return enriched verification orders', async () => {
      context.request.method = 'GET';
      const result = await controller.handleRequest(context);
      expect(result.body['data']).toHaveLength(1);
      expect(result.body['data'][0].id).toEqual('verification-1');
    });

    test('should call finalizeDeferrable', async () => {
      context.request.method = 'GET';
      await controller.handleRequest(context);
      expect(finalizeDeferrable).toHaveBeenCalledWith(context);
    });
  });

  describe('PATCH', () => {
    beforeEach(() => {
      context.request.method = 'PATCH';
      context.request.params = { id: 'verification-1' };
      context.request.body = { resolvedTrusteeId: 'trustee-001' };
      vi.spyOn(
        TrusteeVerificationOrdersUseCase.prototype,
        'approveVerification',
      ).mockResolvedValue();
    });

    test('should call approveVerification and return 204', async () => {
      const result = await controller.handleRequest(context);
      expect(TrusteeVerificationOrdersUseCase.prototype.approveVerification).toHaveBeenCalledWith(
        context,
        'verification-1',
        'trustee-001',
      );
      expect(result.statusCode).toEqual(204);
    });

    test('should throw BadRequestError when id is missing', async () => {
      context.request.params = {};
      await expect(controller.handleRequest(context)).rejects.toThrow(BadRequestError);
    });

    test('should throw BadRequestError when resolvedTrusteeId is missing', async () => {
      context.request.body = {};
      await expect(controller.handleRequest(context)).rejects.toThrow(BadRequestError);
    });

    test('should call finalizeDeferrable', async () => {
      await controller.handleRequest(context);
      expect(finalizeDeferrable).toHaveBeenCalledWith(context);
    });
  });

  describe('unsupported method', () => {
    test('should throw BadRequestError for unsupported methods', async () => {
      context.request.method = 'DELETE';
      await expect(controller.handleRequest(context)).rejects.toThrow(BadRequestError);
    });
  });
});
