import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { TrusteeVerificationOrdersController } from './trustee-verification-orders.controller';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';

describe('TrusteeVerificationOrdersController', () => {
  let context: ApplicationContext;

  const sampleOrder: TrusteeMatchVerification = {
    id: 'case-001:john doe',
    documentType: 'TRUSTEE_MATCH_VERIFICATION',
    orderType: 'trustee-match',
    caseId: 'case-001',
    courtId: '081',
    status: 'pending',
    mismatchReason: 'HIGH_CONFIDENCE_MATCH',
    dxtrTrustee: { fullName: 'John Doe' },
    matchCandidates: [
      {
        trusteeId: 'trustee-001',
        trusteeName: 'John Doe',
        totalScore: 88,
        addressScore: 100,
        districtDivisionScore: 100,
        chapterScore: 60,
      },
    ],
    updatedOn: '2026-01-15T10:00:00.000Z',
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
    createdOn: '2026-01-15T10:00:00.000Z',
    createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
  };

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return verification orders from the repository', async () => {
    vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        search: vi.fn().mockResolvedValue([sampleOrder]),
      }),
    );

    const controller = new TrusteeVerificationOrdersController(context);
    const response = await controller.handleRequest(context);

    expect(response.body.data).toEqual([sampleOrder]);
  });

  test('should return empty array when repository returns no documents', async () => {
    vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), { search: vi.fn().mockResolvedValue([]) }),
    );

    const controller = new TrusteeVerificationOrdersController(context);
    const response = await controller.handleRequest(context);

    expect(response.body.data).toEqual([]);
  });

  test('should throw a CamsError when the repository throws', async () => {
    const error = new Error('Database failure');
    vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), { search: vi.fn().mockRejectedValue(error) }),
    );

    const controller = new TrusteeVerificationOrdersController(context);
    const expectedError = getCamsError(error, 'TRUSTEE-VERIFICATION-ORDERS-CONTROLLER');

    await expect(controller.handleRequest(context)).rejects.toThrow(expectedError.message);
  });
});
