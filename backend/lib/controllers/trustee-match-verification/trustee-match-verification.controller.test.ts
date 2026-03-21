import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { TrusteeMatchVerificationController } from './trustee-match-verification.controller';
import { TrusteeMatchVerificationUseCase } from '../../use-cases/trustee-match-verification/trustee-match-verification.use-case';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { CamsRole } from '@common/cams/roles';

describe('TrusteeMatchVerificationController', () => {
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

  const mockTrustee = {
    public: {
      address: {
        address1: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        countryCode: 'US',
      },
      phone: { number: '(212) 555-0100' },
      email: 'john.doe@example.com',
    },
  };

  const mockAppointments = [
    {
      id: 'appt-001',
      trusteeId: 'trustee-001',
      chapter: '7',
      appointmentType: 'panel',
      courtId: '081',
      courtName: 'Test Court',
      courtDivisionName: 'Division A',
      appointedDate: '2020-01-01',
      status: 'active',
      effectiveDate: '2020-01-01',
    },
  ];

  function mockVerificationRepo(orders: TrusteeMatchVerification[]) {
    vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        search: vi.fn().mockResolvedValue(orders),
      }),
    );
  }

  function mockEnrichmentRepos() {
    vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        read: vi.fn().mockResolvedValue(mockTrustee),
      }),
    );
    vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        getTrusteeAppointments: vi.fn().mockResolvedValue(mockAppointments),
      }),
    );
  }

  beforeEach(async () => {
    context = await createMockApplicationContext();
    context.featureFlags['trustee-verification-enabled'] = true;
    context.request.method = 'GET';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return 404 when trustee-verification-enabled flag is off', async () => {
    context.featureFlags['trustee-verification-enabled'] = false;

    const controller = new TrusteeMatchVerificationController();
    const response = await controller.handleRequest(context);

    expect(response.statusCode).toBe(404);
  });

  describe('GET', () => {
    test('should return verification orders enriched with trustee contact and appointment data', async () => {
      mockVerificationRepo([sampleOrder]);
      mockEnrichmentRepos();

      const controller = new TrusteeMatchVerificationController();
      const response = await controller.handleRequest(context);

      expect(response.body.data).toHaveLength(1);
      const candidate = response.body.data[0].matchCandidates[0];
      expect(candidate.address).toEqual(mockTrustee.public.address);
      expect(candidate.phone).toEqual(mockTrustee.public.phone);
      expect(candidate.email).toEqual(mockTrustee.public.email);
      expect(candidate.appointments).toEqual(mockAppointments);
    });

    test('should return original candidate when enrichment fails', async () => {
      mockVerificationRepo([sampleOrder]);
      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          read: vi.fn().mockRejectedValue(new Error('Trustee not found')),
        }),
      );
      vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          getTrusteeAppointments: vi.fn().mockResolvedValue([]),
        }),
      );

      const controller = new TrusteeMatchVerificationController();
      const response = await controller.handleRequest(context);

      expect(response.body.data).toHaveLength(1);
      const candidate = response.body.data[0].matchCandidates[0];
      expect(candidate.address).toBeUndefined();
      expect(candidate.appointments).toBeUndefined();
    });

    test('should return empty array when repository returns no documents', async () => {
      mockVerificationRepo([]);
      mockEnrichmentRepos();

      const controller = new TrusteeMatchVerificationController();
      const response = await controller.handleRequest(context);

      expect(response.body.data).toEqual([]);
    });

    test('should throw a CamsError when the repository throws', async () => {
      const error = new Error('Database failure');
      vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), { search: vi.fn().mockRejectedValue(error) }),
      );

      const controller = new TrusteeMatchVerificationController();
      const expectedError = getCamsError(error, 'TRUSTEE-MATCH-VERIFICATION-CONTROLLER');

      await expect(controller.handleRequest(context)).rejects.toThrow(expectedError.message);
    });
  });

  describe('PATCH', () => {
    beforeEach(() => {
      context.request.method = 'PATCH';
      context.request.params = { id: 'verification-1' };
      context.request.body = { action: 'approve', resolvedTrusteeId: 'trustee-001' };
      context.session.user.roles = [CamsRole.DataVerifier];
    });

    test('should return 401 when user does not have DataVerifier role', async () => {
      context.session.user.roles = [];

      const controller = new TrusteeMatchVerificationController();

      await expect(controller.handleRequest(context)).rejects.toThrow('Unauthorized');
    });

    test('should call useCase.approveVerification and return 204', async () => {
      vi.spyOn(TrusteeMatchVerificationUseCase.prototype, 'approveVerification').mockResolvedValue(
        undefined,
      );

      const controller = new TrusteeMatchVerificationController();
      const response = await controller.handleRequest(context);

      expect(TrusteeMatchVerificationUseCase.prototype.approveVerification).toHaveBeenCalledWith(
        context,
        'verification-1',
        'trustee-001',
      );
      expect(response.statusCode).toBe(204);
    });

    test('should call useCase.rejectVerification with reason and return 204', async () => {
      context.request.body = { action: 'reject', reason: 'Not the right trustee' };
      vi.spyOn(TrusteeMatchVerificationUseCase.prototype, 'rejectVerification').mockResolvedValue(
        undefined,
      );

      const controller = new TrusteeMatchVerificationController();
      const response = await controller.handleRequest(context);

      expect(TrusteeMatchVerificationUseCase.prototype.rejectVerification).toHaveBeenCalledWith(
        context,
        'verification-1',
        'Not the right trustee',
      );
      expect(response.statusCode).toBe(204);
    });

    test('should call useCase.rejectVerification without reason and return 204', async () => {
      context.request.body = { action: 'reject' };
      vi.spyOn(TrusteeMatchVerificationUseCase.prototype, 'rejectVerification').mockResolvedValue(
        undefined,
      );

      const controller = new TrusteeMatchVerificationController();
      const response = await controller.handleRequest(context);

      expect(TrusteeMatchVerificationUseCase.prototype.rejectVerification).toHaveBeenCalledWith(
        context,
        'verification-1',
        undefined,
      );
      expect(response.statusCode).toBe(204);
    });

    test('should throw BadRequestError when id is missing', async () => {
      context.request.params = {};

      const controller = new TrusteeMatchVerificationController();

      await expect(controller.handleRequest(context)).rejects.toThrow('Missing verification ID.');
    });

    test('should throw BadRequestError when resolvedTrusteeId is missing for approve', async () => {
      context.request.body = { action: 'approve' };

      const controller = new TrusteeMatchVerificationController();

      await expect(controller.handleRequest(context)).rejects.toThrow('Missing resolvedTrusteeId.');
    });

    test('should throw BadRequestError for missing action', async () => {
      context.request.body = {};

      const controller = new TrusteeMatchVerificationController();

      await expect(controller.handleRequest(context)).rejects.toThrow('Missing or invalid action.');
    });

    test('should throw BadRequestError for unrecognized action', async () => {
      context.request.body = { action: 'unknown' };

      const controller = new TrusteeMatchVerificationController();

      await expect(controller.handleRequest(context)).rejects.toThrow('Missing or invalid action.');
    });
  });

  test('should throw BadRequestError for unsupported method', async () => {
    context.request.method = 'DELETE';

    const controller = new TrusteeMatchVerificationController();

    await expect(controller.handleRequest(context)).rejects.toThrow('Unsupported method.');
  });

  test('should throw a CamsError when the repository throws', async () => {
    const error = new Error('Database failure');
    vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), { search: vi.fn().mockRejectedValue(error) }),
    );

    const controller = new TrusteeMatchVerificationController();
    const expectedError = getCamsError(error, 'TRUSTEE-MATCH-VERIFICATION-CONTROLLER');

    await expect(controller.handleRequest(context)).rejects.toThrow(expectedError.message);
  });
});
