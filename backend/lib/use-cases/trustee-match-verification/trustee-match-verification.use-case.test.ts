import { vi, describe, test, expect, beforeEach, Mock } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeMatchVerificationUseCase } from './trustee-match-verification.use-case';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { NotFoundError } from '../../common-errors/not-found-error';
import factory from '../../factory';
import { ObservabilityGateway } from '../../use-cases/gateways.types';
import { CourtsUseCase } from '../courts/courts';
import { TrusteeVerificationRemapMessage } from '@common/cams/dataflow-events';

describe('TrusteeMatchVerificationUseCase', () => {
  let context: ApplicationContext;
  let useCase: TrusteeMatchVerificationUseCase;

  const sampleVerification: TrusteeMatchVerification = {
    id: 'verification-1',
    documentType: 'TRUSTEE_MATCH_VERIFICATION',
    caseId: 'case-001',
    courtId: '081',
    dxtrTrustee: { fullName: 'John Doe' },
    mismatchReason: 'IMPERFECT_MATCH',
    matchCandidates: [
      {
        trusteeId: 'trustee-a',
        trusteeName: 'Alice',
        totalScore: 90,
        addressScore: 80,
        nameScore: 80,
        phoneScore: null,
        emailScore: null,
        districtDivisionScore: 100,
        chapterScore: 90,
      },
      {
        trusteeId: 'trustee-b',
        trusteeName: 'Bob',
        totalScore: 70,
        addressScore: 60,
        nameScore: 60,
        phoneScore: null,
        emailScore: null,
        districtDivisionScore: 80,
        chapterScore: 70,
      },
    ],
    taskType: 'trustee-match',
    status: 'pending',
    createdOn: '2025-01-01T00:00:00.000Z',
    updatedOn: '2025-01-01T00:00:00.000Z',
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
    taskDate: '2025-01-01T00:00:00.000Z',
    fingerprint: 'fp-abc123',
    variant: '{"firstName":"john","lastName":"doe"}',
  };

  let mockFindById: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockCreateProfessionalId: ReturnType<typeof vi.fn>;
  let mockFindVariationByFingerprint: ReturnType<typeof vi.fn>;
  let mockCreateVariation: ReturnType<typeof vi.fn>;
  let mockQueueTrusteeVerificationRemap: Mock<
    (message: TrusteeVerificationRemapMessage) => Promise<void>
  >;
  let mockCompleteTrace: ObservabilityGateway['completeTrace'];
  let mockGetSurrogatesByFingerprint: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    mockCompleteTrace = vi.fn();
    vi.spyOn(context.observability, 'completeTrace').mockImplementation(mockCompleteTrace);
    useCase = new TrusteeMatchVerificationUseCase();

    mockFindById = vi.fn().mockResolvedValue(sampleVerification);
    mockUpdate = vi.fn().mockResolvedValue({ ...sampleVerification, status: 'approved' });
    mockCreateProfessionalId = vi.fn().mockResolvedValue({});
    mockFindVariationByFingerprint = vi.fn().mockResolvedValue([]);
    mockCreateVariation = vi.fn().mockResolvedValue({});
    mockQueueTrusteeVerificationRemap = vi.fn().mockResolvedValue(undefined);
    mockGetSurrogatesByFingerprint = vi.fn().mockResolvedValue([]);

    vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        getSurrogatesByFingerprint: mockGetSurrogatesByFingerprint,
      }),
    );
    vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        findById: mockFindById,
        update: mockUpdate,
      }),
    );
    vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        createProfessionalId: mockCreateProfessionalId,
      }),
    );
    vi.spyOn(factory, 'getTrusteeVariationRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        findByFingerprint: mockFindVariationByFingerprint,
        createVariation: mockCreateVariation,
      }),
    );
    vi.spyOn(factory, 'getApiToDataflowsGateway').mockReturnValue({
      queueTrusteeVerificationRemap: mockQueueTrusteeVerificationRemap,
      queueCaseAssignmentEvent: vi.fn(),
      queueTrusteeAppointmentEvent: vi.fn(),
      queueCaseReload: vi.fn(),
    });
  });

  describe('getVerifications', () => {
    let mockSearch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockSearch = vi.fn().mockResolvedValue([sampleVerification]);
      vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          findById: mockFindById,
          update: mockUpdate,
          search: mockSearch,
        }),
      );
      vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue([]);
    });

    test('defaults to pending status when no statusParam provided', async () => {
      await useCase.getVerifications(context, {});

      expect(mockSearch).toHaveBeenCalledWith({ status: ['pending'] });
    });

    test('parses comma-separated statuses from statusParam', async () => {
      await useCase.getVerifications(context, { statusParam: 'approved,rejected' });

      expect(mockSearch).toHaveBeenCalledWith({ status: ['approved', 'rejected'] });
    });

    test('returns data from repository', async () => {
      const result = await useCase.getVerifications(context, {});

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('verification-1');
    });

    test('resolves courtName with division name when a matching court is found by divisionCode', async () => {
      mockSearch.mockResolvedValue([
        { ...sampleVerification, caseId: '081-24-12345', courtId: '081' },
      ]);
      vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue([
        {
          officeName: 'Office',
          officeCode: '081',
          courtId: '081',
          courtName: 'Test Court',
          courtDivisionCode: '081',
          courtDivisionName: 'Test Division',
          groupDesignator: 'NY',
          regionId: '1',
          regionName: 'Region 1',
        },
      ]);

      const result = await useCase.getVerifications(context, {});

      expect(result[0].courtName).toBe('Test Court - Test Division');
    });

    test('resolves courtName without a division suffix when courtDivisionName is empty', async () => {
      mockSearch.mockResolvedValue([
        { ...sampleVerification, caseId: '081-24-12345', courtId: '081' },
      ]);
      vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue([
        {
          officeName: 'Office',
          officeCode: '081',
          courtId: '081',
          courtName: 'Test Court',
          courtDivisionCode: '081',
          courtDivisionName: '',
          groupDesignator: 'NY',
          regionId: '1',
          regionName: 'Region 1',
        },
      ]);

      const result = await useCase.getVerifications(context, {});

      expect(result[0].courtName).toBe('Test Court');
    });

    test('falls back to matching by courtId when caseId cannot be parsed into division parts', async () => {
      mockSearch.mockResolvedValue([
        { ...sampleVerification, caseId: 'not-a-valid-case-id', courtId: '081' },
      ]);
      vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue([
        {
          officeName: 'Office',
          officeCode: '081',
          courtId: '081',
          courtName: 'Test Court',
          courtDivisionCode: '999',
          courtDivisionName: 'Other Division',
          groupDesignator: 'NY',
          regionId: '1',
          regionName: 'Region 1',
        },
      ]);

      const result = await useCase.getVerifications(context, {});

      expect(result[0].courtName).toBe('Test Court - Other Division');
    });

    test('selects the highest-scoring candidate as preselectedCandidate for MultipleTrusteesMatch', async () => {
      mockSearch.mockResolvedValue([
        { ...sampleVerification, mismatchReason: 'MULTIPLE_TRUSTEES_MATCH' },
      ]);

      const result = await useCase.getVerifications(context, {});

      expect(result[0].preselectedCandidate).toEqual({
        trusteeId: 'trustee-a',
        trusteeName: 'Alice',
      });
      expect(result[0].candidateCount).toBe(2);
    });

    test('preselects the first candidate for non-multiple-match mismatch reasons', async () => {
      const result = await useCase.getVerifications(context, {});

      expect(result[0].preselectedCandidate).toEqual({
        trusteeId: 'trustee-a',
        trusteeName: 'Alice',
      });
    });

    test('returns null preselectedCandidate when there are no match candidates', async () => {
      mockSearch.mockResolvedValue([{ ...sampleVerification, matchCandidates: [] }]);

      const result = await useCase.getVerifications(context, {});

      expect(result[0].preselectedCandidate).toBeNull();
      expect(result[0].candidateCount).toBe(0);
    });

    test('computes affectedCaseCount from surrogate rows sharing the fingerprint', async () => {
      mockGetSurrogatesByFingerprint.mockResolvedValue([
        { caseId: 'case-001', trusteeId: 'fp-abc123', isSurrogate: true },
        { caseId: 'case-002', trusteeId: 'fp-abc123', isSurrogate: true },
      ]);

      const result = await useCase.getVerifications(context, {});

      expect(mockGetSurrogatesByFingerprint).toHaveBeenCalledWith('fp-abc123');
      expect(result[0].affectedCaseCount).toBe(2);
    });

    test('returns affectedCaseCount of 0 when no surrogate cases remain', async () => {
      mockGetSurrogatesByFingerprint.mockResolvedValue([]);

      const result = await useCase.getVerifications(context, {});

      expect(result[0].affectedCaseCount).toBe(0);
    });
  });

  describe('approveVerification', () => {
    test('happy path: writes TRUSTEE_VARIATION, marks approved, enqueues remap message', async () => {
      await useCase.approveVerification(context, 'verification-1', 'trustee-new', 'New Trustee');

      expect(mockFindById).toHaveBeenCalledWith('verification-1');
      expect(mockFindVariationByFingerprint).toHaveBeenCalledWith('fp-abc123');
      expect(mockCreateVariation).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'TRUSTEE_VARIATION',
          fingerprint: 'fp-abc123',
          variant: '{"firstName":"john","lastName":"doe"}',
          trusteeId: 'trustee-new',
        }),
      );
      expect(mockUpdate).toHaveBeenCalledWith(
        'verification-1',
        expect.objectContaining({
          status: 'approved',
          resolvedTrusteeId: 'trustee-new',
          resolvedTrusteeName: 'New Trustee',
          updatedBy: expect.objectContaining({ id: expect.any(String) }),
          updatedOn: expect.any(String),
        }),
      );
      expect(mockQueueTrusteeVerificationRemap).toHaveBeenCalledWith({
        fingerprint: 'fp-abc123',
        resolvedTrusteeId: 'trustee-new',
        resolvedTrusteeName: 'New Trustee',
        verificationId: 'verification-1',
      });
    });

    test('does not create a TRUSTEE_VARIATION when the bucket already has this exact variant', async () => {
      mockFindVariationByFingerprint.mockResolvedValue([
        {
          id: 'variation-1',
          documentType: 'TRUSTEE_VARIATION',
          fingerprint: 'fp-abc123',
          variant: '{"firstName":"john","lastName":"doe"}',
          trusteeId: 'trustee-new',
        },
      ]);

      await useCase.approveVerification(context, 'verification-1', 'trustee-new');

      expect(mockCreateVariation).not.toHaveBeenCalled();
    });

    test('creates a TRUSTEE_VARIATION when the bucket only has a different variant (fingerprint collision)', async () => {
      mockFindVariationByFingerprint.mockResolvedValue([
        {
          id: 'variation-1',
          documentType: 'TRUSTEE_VARIATION',
          fingerprint: 'fp-abc123',
          variant: '{"firstName":"jane","lastName":"doe"}',
          trusteeId: 'trustee-other',
        },
      ]);

      await useCase.approveVerification(context, 'verification-1', 'trustee-new');

      expect(mockCreateVariation).toHaveBeenCalledWith(
        expect.objectContaining({ variant: '{"firstName":"john","lastName":"doe"}' }),
      );
    });

    test('emits TrusteeMatchVerificationResolved telemetry with wasPreselectedConfirmed=true when preselected trustee is approved', async () => {
      await useCase.approveVerification(context, 'verification-1', 'trustee-a');

      expect(mockCompleteTrace).toHaveBeenCalledWith(
        expect.anything(),
        'TrusteeMatchVerificationResolved',
        expect.objectContaining({
          success: true,
          properties: expect.objectContaining({
            action: 'approve',
            caseId: 'case-001',
            mismatchReason: 'IMPERFECT_MATCH',
            wasPreselectedConfirmed: 'true',
          }),
          measurements: expect.objectContaining({
            resolutionMs: expect.any(Number),
            candidateCount: 2,
          }),
        }),
        [{ name: 'TrusteeVerificationResolutionMs', value: expect.any(Number) }],
        context.logger,
      );
    });

    test('emits TrusteeMatchVerificationResolved telemetry with wasPreselectedConfirmed=false when non-preselected trustee is approved', async () => {
      await useCase.approveVerification(context, 'verification-1', 'trustee-b');

      expect(mockCompleteTrace).toHaveBeenCalledWith(
        expect.anything(),
        'TrusteeMatchVerificationResolved',
        expect.objectContaining({
          properties: expect.objectContaining({ wasPreselectedConfirmed: 'false' }),
        }),
        expect.anything(),
        context.logger,
      );
    });

    test('emits failed telemetry when approveVerification throws', async () => {
      mockFindById.mockRejectedValue(new NotFoundError('REPO', { message: 'Not found' }));

      await expect(
        useCase.approveVerification(context, 'missing-id', 'trustee-new'),
      ).rejects.toThrow();

      expect(mockCompleteTrace).toHaveBeenCalledWith(
        expect.anything(),
        'TrusteeMatchVerificationResolved',
        expect.objectContaining({ success: false, properties: { action: 'approve' } }),
        undefined,
        context.logger,
      );
    });

    test('throws NotFoundError when document does not exist', async () => {
      mockFindById.mockRejectedValue(new NotFoundError('REPO', { message: 'Not found' }));

      await expect(
        useCase.approveVerification(context, 'missing-id', 'trustee-new'),
      ).rejects.toThrow(NotFoundError);
    });

    test('throws NotFoundError when verification exists but is not pending', async () => {
      mockFindById.mockResolvedValue({ ...sampleVerification, status: 'approved' });

      await expect(
        useCase.approveVerification(context, 'verification-1', 'trustee-new'),
      ).rejects.toThrow(NotFoundError);
    });

    test('does not enqueue a remap when the verification lookup fails', async () => {
      mockFindById.mockRejectedValue(new NotFoundError('REPO', { message: 'Not found' }));

      await expect(
        useCase.approveVerification(context, 'missing-id', 'trustee-new'),
      ).rejects.toThrow();

      expect(mockQueueTrusteeVerificationRemap).not.toHaveBeenCalled();
    });

    test('leaves the verification pending (retryable) when the remap enqueue fails', async () => {
      mockQueueTrusteeVerificationRemap.mockRejectedValueOnce(new Error('queue unavailable'));

      await expect(
        useCase.approveVerification(context, 'verification-1', 'trustee-new'),
      ).rejects.toThrow();

      // The status write must not have happened -- a failed enqueue must not leave the
      // verification permanently 'approved' with no way to re-trigger the remap.
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    test('creates a trustee-professional-ids mapping when the verification has acmsProfessionalId', async () => {
      mockFindById.mockResolvedValue({
        ...sampleVerification,
        acmsProfessionalId: '081-00123',
      });

      await useCase.approveVerification(context, 'verification-1', 'trustee-new');

      expect(mockCreateProfessionalId).toHaveBeenCalledWith(
        'trustee-new',
        '081-00123',
        expect.objectContaining({ id: expect.any(String) }),
      );
    });

    test('does not attempt a professional-ids mapping when the verification has no acmsProfessionalId', async () => {
      await useCase.approveVerification(context, 'verification-1', 'trustee-new');

      expect(mockCreateProfessionalId).not.toHaveBeenCalled();
    });
  });

  describe('getEnrichedVerification', () => {
    let mockTrusteeRead: ReturnType<typeof vi.fn>;
    let mockGetTrusteeAppointments: ReturnType<typeof vi.fn>;

    const makeTrustee = (trusteeId: string) => ({
      trusteeId,
      name: `Trustee ${trusteeId}`,
      public: {
        address: { address1: '123 Main St' },
        phone: { number: '555-1234' },
        email: 'trustee@example.com',
      },
    });

    beforeEach(() => {
      mockTrusteeRead = vi
        .fn()
        .mockImplementation((trusteeId: string) => Promise.resolve(makeTrustee(trusteeId)));
      mockGetTrusteeAppointments = vi.fn().mockResolvedValue([]);

      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), { read: mockTrusteeRead }),
      );
      vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          getTrusteeAppointments: mockGetTrusteeAppointments,
        }),
      );
    });

    test('enriches every candidate with trustee contact info and appointment history', async () => {
      const result = await useCase.getEnrichedVerification(context, 'verification-1');

      expect(result.matchCandidates).toHaveLength(2);
      expect(result.matchCandidates[0]).toEqual(
        expect.objectContaining({
          trusteeId: 'trustee-a',
          address: { address1: '123 Main St' },
          phone: { number: '555-1234' },
          email: 'trustee@example.com',
          appointments: [],
        }),
      );
    });

    test('falls back to the raw candidate when enrichment fails for that candidate', async () => {
      mockTrusteeRead.mockImplementation((trusteeId: string) => {
        if (trusteeId === 'trustee-a') return Promise.reject(new Error('not found'));
        return Promise.resolve(makeTrustee(trusteeId));
      });

      const result = await useCase.getEnrichedVerification(context, 'verification-1');

      expect(result.matchCandidates[0]).toEqual(sampleVerification.matchCandidates[0]);
      expect(result.matchCandidates[1]).toEqual(
        expect.objectContaining({ trusteeId: 'trustee-b', address: expect.anything() }),
      );
    });

    test('backfills resolvedTrusteeName when approved and the resolved trustee is not in matchCandidates', async () => {
      mockFindById.mockResolvedValue({
        ...sampleVerification,
        status: 'approved',
        resolvedTrusteeId: 'trustee-z',
        resolvedTrusteeName: undefined,
      });
      mockTrusteeRead.mockImplementation((trusteeId: string) => {
        if (trusteeId === 'trustee-z') return Promise.resolve(makeTrustee('trustee-z'));
        return Promise.resolve(makeTrustee(trusteeId));
      });

      const result = await useCase.getEnrichedVerification(context, 'verification-1');

      expect(result.resolvedTrusteeName).toBe('Trustee trustee-z');
    });

    test('leaves resolvedTrusteeName undefined when the backfill lookup fails', async () => {
      mockFindById.mockResolvedValue({
        ...sampleVerification,
        status: 'approved',
        resolvedTrusteeId: 'trustee-z',
        resolvedTrusteeName: undefined,
      });
      mockTrusteeRead.mockImplementation((trusteeId: string) => {
        if (trusteeId === 'trustee-z') return Promise.reject(new Error('not found'));
        return Promise.resolve(makeTrustee(trusteeId));
      });

      const result = await useCase.getEnrichedVerification(context, 'verification-1');

      expect(result.resolvedTrusteeName).toBeUndefined();
    });

    test('does not attempt to backfill resolvedTrusteeName when already present', async () => {
      mockFindById.mockResolvedValue({
        ...sampleVerification,
        status: 'approved',
        resolvedTrusteeId: 'trustee-a',
        resolvedTrusteeName: 'Already Resolved',
      });

      const result = await useCase.getEnrichedVerification(context, 'verification-1');

      expect(result.resolvedTrusteeName).toBe('Already Resolved');
    });

    test('includes affectedCaseIds from surrogate rows sharing the fingerprint', async () => {
      mockGetSurrogatesByFingerprint.mockResolvedValue([
        { caseId: 'case-001', trusteeId: 'fp-abc123', isSurrogate: true },
        { caseId: 'case-002', trusteeId: 'fp-abc123', isSurrogate: true },
      ]);

      const result = await useCase.getEnrichedVerification(context, 'verification-1');

      expect(mockGetSurrogatesByFingerprint).toHaveBeenCalledWith('fp-abc123');
      expect(result.affectedCaseIds).toEqual(['case-001', 'case-002']);
    });

    test('returns an empty affectedCaseIds when no surrogate cases remain (resolution already in progress or complete)', async () => {
      mockGetSurrogatesByFingerprint.mockResolvedValue([]);

      const result = await useCase.getEnrichedVerification(context, 'verification-1');

      expect(result.affectedCaseIds).toEqual([]);
    });

    test('logs a warning when affected case count exceeds the sanity cap', async () => {
      const manyCases = Array.from({ length: 51 }, (_, i) => ({
        caseId: `case-${i}`,
        trusteeId: 'fp-abc123',
        isSurrogate: true,
      }));
      mockGetSurrogatesByFingerprint.mockResolvedValue(manyCases);
      const warnSpy = vi.spyOn(context.logger, 'warn');

      const result = await useCase.getEnrichedVerification(context, 'verification-1');

      expect(result.affectedCaseIds).toHaveLength(51);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('fp-abc123'),
      );
    });
  });

  describe('rejectVerification', () => {
    test('happy path with reason: sets status to rejected with reason, updatedBy, updatedOn', async () => {
      await useCase.rejectVerification(context, 'verification-1', 'Not the right trustee');

      expect(mockFindById).toHaveBeenCalledWith('verification-1');
      expect(mockUpdate).toHaveBeenCalledWith(
        'verification-1',
        expect.objectContaining({
          status: 'rejected',
          reason: 'Not the right trustee',
          updatedBy: expect.objectContaining({ id: expect.any(String) }),
          updatedOn: expect.any(String),
        }),
      );
    });

    test('emits TrusteeMatchVerificationResolved telemetry on rejection', async () => {
      await useCase.rejectVerification(context, 'verification-1', 'Not the right trustee');

      expect(mockCompleteTrace).toHaveBeenCalledWith(
        expect.anything(),
        'TrusteeMatchVerificationResolved',
        expect.objectContaining({
          success: true,
          properties: expect.objectContaining({
            action: 'reject',
            caseId: 'case-001',
            mismatchReason: 'IMPERFECT_MATCH',
          }),
          measurements: expect.objectContaining({
            resolutionMs: expect.any(Number),
            candidateCount: 2,
          }),
        }),
        [{ name: 'TrusteeVerificationResolutionMs', value: expect.any(Number) }],
        context.logger,
      );
    });

    test('emits failed telemetry when rejectVerification throws', async () => {
      mockFindById.mockRejectedValue(new NotFoundError('REPO', { message: 'Not found' }));

      await expect(useCase.rejectVerification(context, 'missing-id')).rejects.toThrow();

      expect(mockCompleteTrace).toHaveBeenCalledWith(
        expect.anything(),
        'TrusteeMatchVerificationResolved',
        expect.objectContaining({ success: false, properties: { action: 'reject' } }),
        undefined,
        context.logger,
      );
    });

    test('happy path without reason: sets status to rejected with undefined reason', async () => {
      await useCase.rejectVerification(context, 'verification-1');

      expect(mockUpdate).toHaveBeenCalledWith(
        'verification-1',
        expect.objectContaining({
          status: 'rejected',
          reason: undefined,
        }),
      );
    });

    test('throws NotFoundError when document does not exist', async () => {
      mockFindById.mockRejectedValue(new NotFoundError('REPO', { message: 'Not found' }));

      await expect(useCase.rejectVerification(context, 'missing-id')).rejects.toThrow(
        NotFoundError,
      );
    });

    test('throws NotFoundError when verification exists but is not pending', async () => {
      mockFindById.mockResolvedValue({ ...sampleVerification, status: 'approved' });

      await expect(useCase.rejectVerification(context, 'verification-1')).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
