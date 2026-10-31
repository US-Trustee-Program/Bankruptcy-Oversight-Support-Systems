import { vi, describe, test, expect, beforeEach, Mock } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext, getTheThrownError } from '../../testing/testing-utilities';
import { TrusteeMatchVerificationUseCase } from './trustee-match-verification.use-case';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { NotFoundError } from '../../common-errors/not-found-error';
import { BadRequestError } from '../../common-errors/bad-request';
import factory from '../../factory';
import { ObservabilityGateway } from '../../use-cases/gateways.types';
import { CourtsUseCase } from '../courts/courts';
import CaseManagement from '../cases/case-management';
import { CaseSummary } from '@common/cams/cases';
import { TrusteeVerificationRemapMessage } from '@common/cams/dataflow-events';
import MockData from '@common/cams/test-utilities/mock-data';

describe('TrusteeMatchVerificationUseCase', () => {
  let context: ApplicationContext;
  let useCase: TrusteeMatchVerificationUseCase;

  const alice = MockData.getTrusteeMatchCandidate({ trusteeId: 'trustee-a', name: 'Alice' });
  const bob = MockData.getTrusteeMatchCandidate(
    { trusteeId: 'trustee-b', name: 'Bob' },
    {
      doesNameMatch: { pass: true, quality: 'exact' },
      doesAddressMatch: { pass: true, quality: 'moderate', points: 3 },
    },
  );

  const sampleVerification: TrusteeMatchVerification = {
    id: 'verification-1',
    documentType: 'TRUSTEE_MATCH_VERIFICATION',
    caseId: 'case-001',
    courtId: '081',
    dxtrTrustee: { fullName: 'John Doe' },
    mismatchReason: 'ambiguous',
    source: 'DXTR',
    // Alice ranks first (more address points); Bob second.
    findings: MockData.getTrusteeMatchFindings({
      candidates: [alice, bob],
    }),
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
  let mockUpdateIfPending: ReturnType<typeof vi.fn>;
  let mockFindVariationByFingerprint: ReturnType<typeof vi.fn>;
  let mockCreateVariation: ReturnType<typeof vi.fn>;
  let mockQueueTrusteeVerificationRemap: Mock<
    (message: TrusteeVerificationRemapMessage) => Promise<void>
  >;
  let mockCompleteTrace: ObservabilityGateway['completeTrace'];
  let mockGetSurrogatesByFingerprints: ReturnType<typeof vi.fn>;
  let mockGetTrusteeAppointments: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    mockCompleteTrace = vi.fn();
    vi.spyOn(context.observability, 'completeTrace').mockImplementation(mockCompleteTrace);
    useCase = new TrusteeMatchVerificationUseCase();

    mockFindById = vi.fn().mockResolvedValue(sampleVerification);
    mockUpdateIfPending = vi.fn().mockResolvedValue(true);
    mockFindVariationByFingerprint = vi.fn().mockResolvedValue([]);
    mockCreateVariation = vi.fn().mockResolvedValue({});
    mockQueueTrusteeVerificationRemap = vi.fn().mockResolvedValue(undefined);
    mockGetSurrogatesByFingerprints = vi.fn().mockResolvedValue([]);
    mockGetTrusteeAppointments = vi.fn().mockResolvedValue([]);

    vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        getSurrogatesByFingerprints: mockGetSurrogatesByFingerprints,
      }),
    );
    vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        getTrusteeAppointments: mockGetTrusteeAppointments,
      }),
    );
    vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        findById: mockFindById,
        updateIfPending: mockUpdateIfPending,
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
      queueCaseReload: vi.fn(),
      queueTrusteeChangeNotification: vi.fn(),
    });
  });

  describe('getVerifications', () => {
    let mockSearch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockSearch = vi.fn().mockResolvedValue([sampleVerification]);
      vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          findById: mockFindById,
          updateIfPending: mockUpdateIfPending,
          search: mockSearch,
        }),
      );
      vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue([]);
    });

    test.each([
      {
        name: 'defaults to pending status when no statusParam provided',
        statusParam: undefined,
        expectedStatus: ['pending'],
      },
      {
        name: 'parses comma-separated statuses from statusParam',
        statusParam: 'pending,approved',
        expectedStatus: ['pending', 'approved'],
      },
      {
        name: 'filters out rejected from statusParam since it is no longer a valid status',
        statusParam: 'approved,rejected',
        expectedStatus: ['approved'],
      },
      {
        name: 'drops rejected but keeps pending and approved when all three are selected (default UI filter state)',
        statusParam: 'pending,approved,rejected',
        expectedStatus: ['pending', 'approved'],
      },
    ])('$name', async ({ statusParam, expectedStatus }) => {
      await useCase.getVerifications(context, { statusParam });

      expect(mockSearch).toHaveBeenCalledWith({ status: expectedStatus });
    });

    test('returns no results without querying when statusParam is entirely invalid statuses', async () => {
      const result = await useCase.getVerifications(context, { statusParam: 'rejected' });

      expect(result).toEqual([]);
      expect(mockSearch).not.toHaveBeenCalled();
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

    test('falls back to verification.courtName when caseId parses but no court matches by division or courtId', async () => {
      mockSearch.mockResolvedValue([
        { ...sampleVerification, caseId: '081-24-12345', courtId: '081', courtName: undefined },
      ]);
      vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue([
        {
          officeName: 'Office',
          officeCode: '999',
          courtId: '999',
          courtName: 'Unrelated Court',
          courtDivisionCode: '999',
          courtDivisionName: 'Unrelated Division',
          groupDesignator: 'NY',
          regionId: '1',
          regionName: 'Region 1',
        },
      ]);

      const result = await useCase.getVerifications(context, {});

      expect(result[0].courtName).toBeUndefined();
    });

    test('resolves courtName by courtId alone when caseId is absent (caseless task)', async () => {
      mockSearch.mockResolvedValue([{ ...sampleVerification, caseId: undefined, courtId: '081' }]);
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

    test('resolves courtName to undefined when both caseId and courtId are absent or unmatched', async () => {
      mockSearch.mockResolvedValue([
        { ...sampleVerification, caseId: undefined, courtId: undefined, courtName: undefined },
      ]);
      vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue([
        {
          officeName: 'Office',
          officeCode: '999',
          courtId: '999',
          courtName: 'Unrelated Court',
          courtDivisionCode: '999',
          courtDivisionName: 'Unrelated Division',
          groupDesignator: 'NY',
          regionId: '1',
          regionName: 'Region 1',
        },
      ]);

      const result = await useCase.getVerifications(context, {});

      expect(result[0].courtName).toBeUndefined();
    });

    test('computes affectedCaseCount/affectedCaseIds from surrogate rows sharing the fingerprint', async () => {
      mockGetSurrogatesByFingerprints.mockResolvedValue([
        { caseId: 'case-001', trusteeId: 'fp-abc123', isSurrogate: true },
        { caseId: 'case-002', trusteeId: 'fp-abc123', isSurrogate: true },
      ]);

      const result = await useCase.getVerifications(context, {});

      expect(mockGetSurrogatesByFingerprints).toHaveBeenCalledWith(['fp-abc123']);
      expect(result[0].affectedCaseCount).toBe(2);
      expect(result[0].affectedCaseIds).toEqual(['case-001', 'case-002']);
    });

    test('returns affectedCaseCount of 0 and an empty affectedCaseIds when no surrogate cases remain', async () => {
      mockGetSurrogatesByFingerprints.mockResolvedValue([]);

      const result = await useCase.getVerifications(context, {});

      expect(result[0].affectedCaseCount).toBe(0);
      expect(result[0].affectedCaseIds).toEqual([]);
    });

    test('computes affectedCaseCount/affectedCaseIds from affectedCaseIds when present, without querying live surrogates', async () => {
      mockSearch.mockResolvedValue([
        {
          ...sampleVerification,
          status: 'approved',
          affectedCaseIds: ['case-a', 'case-b', 'case-c'],
        },
      ]);

      const result = await useCase.getVerifications(context, {});

      expect(result[0].affectedCaseCount).toBe(3);
      expect(result[0].affectedCaseIds).toEqual(['case-a', 'case-b', 'case-c']);
      expect(mockGetSurrogatesByFingerprints).not.toHaveBeenCalled();
    });

    test('only queries live surrogates for rows without an affectedCaseIds snapshot, in a mixed page', async () => {
      mockSearch.mockResolvedValue([
        { ...sampleVerification, status: 'approved', affectedCaseIds: ['case-a'] },
        {
          ...sampleVerification,
          id: 'verification-2',
          fingerprint: 'fp-xyz789',
          status: 'pending',
        },
      ]);
      mockGetSurrogatesByFingerprints.mockResolvedValue([
        { caseId: 'case-live-1', trusteeId: 'fp-xyz789', isSurrogate: true },
      ]);

      const result = await useCase.getVerifications(context, {});

      expect(mockGetSurrogatesByFingerprints).toHaveBeenCalledWith(['fp-xyz789']);
      expect(result[0].affectedCaseCount).toBe(1);
      expect(result[1].affectedCaseCount).toBe(1);
    });

    test('batches all fingerprints in a page into a single query instead of one per row', async () => {
      mockSearch.mockResolvedValue([
        sampleVerification,
        {
          ...sampleVerification,
          id: 'verification-2',
          caseId: 'case-002',
          fingerprint: 'fp-xyz789',
        },
      ]);
      mockGetSurrogatesByFingerprints.mockResolvedValue([]);

      await useCase.getVerifications(context, {});

      expect(mockGetSurrogatesByFingerprints).toHaveBeenCalledTimes(1);
      expect(mockGetSurrogatesByFingerprints).toHaveBeenCalledWith(['fp-abc123', 'fp-xyz789']);
    });

    test('rethrows via getCamsError when the repository search fails', async () => {
      mockSearch.mockRejectedValue(new Error('db unavailable'));

      await expect(useCase.getVerifications(context, {})).rejects.toThrow();
    });

    test('rethrows via getCamsError when resolving courts fails', async () => {
      vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockRejectedValue(new Error('courts down'));

      await expect(useCase.getVerifications(context, {})).rejects.toThrow();
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
      expect(mockUpdateIfPending).toHaveBeenCalledWith(
        'verification-1',
        expect.objectContaining({
          status: 'approved',
          resolvedTrusteeId: 'trustee-new',
          resolvedTrusteeName: 'New Trustee',
          remap: { status: 'pending' },
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
            mismatchReason: 'ambiguous',
            wasPreselectedConfirmed: 'true',
            resolutionPath: 'accepted',
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
          properties: expect.objectContaining({
            wasPreselectedConfirmed: 'false',
            resolutionPath: 'manual-search',
          }),
        }),
        expect.anything(),
        context.logger,
      );
    });

    test('resolves wasPreselectedConfirmed against the top-ranked candidate, not discovery order', async () => {
      mockFindById.mockResolvedValue({
        ...sampleVerification,
        // Bob discovered first; Alice still ranks first, so approving her confirms the
        // preselection.
        findings: { ...sampleVerification.findings, candidates: [bob, alice] },
      });

      await useCase.approveVerification(context, 'verification-1', 'trustee-a');

      expect(mockCompleteTrace).toHaveBeenCalledWith(
        expect.anything(),
        'TrusteeMatchVerificationResolved',
        expect.objectContaining({
          properties: expect.objectContaining({ wasPreselectedConfirmed: 'true' }),
        }),
        expect.anything(),
        context.logger,
      );
    });

    test('treats no candidate as preselected when the findings have no candidates', async () => {
      mockFindById.mockResolvedValue({
        ...sampleVerification,
        findings: { ...sampleVerification.findings, candidates: [] },
      });

      await useCase.approveVerification(context, 'verification-1', 'trustee-new');

      expect(mockCompleteTrace).toHaveBeenCalledWith(
        expect.anything(),
        'TrusteeMatchVerificationResolved',
        expect.objectContaining({
          properties: expect.objectContaining({ wasPreselectedConfirmed: 'false' }),
          measurements: expect.objectContaining({ candidateCount: 0 }),
        }),
        expect.anything(),
        context.logger,
      );
    });

    test('reports resolutionMs as 0 when the verification has no createdOn', async () => {
      mockFindById.mockResolvedValue({ ...sampleVerification, createdOn: undefined });

      await useCase.approveVerification(context, 'verification-1', 'trustee-a');

      expect(mockCompleteTrace).toHaveBeenCalledWith(
        expect.anything(),
        'TrusteeMatchVerificationResolved',
        expect.objectContaining({
          measurements: expect.objectContaining({ resolutionMs: 0 }),
        }),
        expect.anything(),
        context.logger,
      );
    });

    test("includes the resolved trustee's 1-based rank as selectedCandidateRank", async () => {
      mockFindById.mockResolvedValue({
        ...sampleVerification,
        findings: { ...sampleVerification.findings, candidates: [bob, alice] },
      });

      await useCase.approveVerification(context, 'verification-1', 'trustee-b');

      const [, , eventBody] = vi.mocked(context.observability.completeTrace).mock.calls[0];
      expect(eventBody.properties.selectedCandidateRank).toBe('2');
    });

    test('omits selectedCandidateRank from telemetry when the resolved trustee is not among the candidates', async () => {
      await useCase.approveVerification(context, 'verification-1', 'trustee-unknown');

      const [, , eventBody] = vi.mocked(context.observability.completeTrace).mock.calls[0];
      expect('selectedCandidateRank' in eventBody.properties).toBe(false);
    });

    test('omits caseId from telemetry for a caseless verification, without throwing', async () => {
      mockFindById.mockResolvedValue({ ...sampleVerification, caseId: undefined });

      await useCase.approveVerification(context, 'verification-1', 'trustee-a');

      const [, , eventBody] = vi.mocked(context.observability.completeTrace).mock.calls[0];
      expect('caseId' in eventBody.properties).toBe(false);
    });

    describe('when the verification lookup fails', () => {
      beforeEach(() => {
        mockFindById.mockRejectedValue(new NotFoundError('REPO', { message: 'Not found' }));
      });

      test('emits failed telemetry when approveVerification throws', async () => {
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
        await expect(
          useCase.approveVerification(context, 'missing-id', 'trustee-new'),
        ).rejects.toThrow(NotFoundError);
      });

      test('does not enqueue a remap when the verification lookup fails', async () => {
        await expect(
          useCase.approveVerification(context, 'missing-id', 'trustee-new'),
        ).rejects.toThrow();

        expect(mockQueueTrusteeVerificationRemap).not.toHaveBeenCalled();
      });
    });

    test('throws NotFoundError when verification exists but is not pending', async () => {
      mockFindById.mockResolvedValue({ ...sampleVerification, status: 'approved' });

      await expect(
        useCase.approveVerification(context, 'verification-1', 'trustee-new'),
      ).rejects.toThrow(NotFoundError);
    });

    test('persists the approval and snapshot even when the remap enqueue fails afterward', async () => {
      mockQueueTrusteeVerificationRemap.mockRejectedValueOnce(new Error('queue unavailable'));

      await expect(
        useCase.approveVerification(context, 'verification-1', 'trustee-new'),
      ).rejects.toThrow();

      // The approval and its affectedCaseIds snapshot are the durable record we protect --
      // they're written before the enqueue, so a failed send doesn't lose them. The error
      // still propagates so a failure to notify the remap job is never silently swallowed.
      expect(mockUpdateIfPending).toHaveBeenCalledWith(
        'verification-1',
        expect.objectContaining({ status: 'approved' }),
      );
    });

    test('snapshots affectedCaseIds onto the same update call that sets status approved', async () => {
      mockGetSurrogatesByFingerprints.mockResolvedValue([
        { caseId: 'case-001', trusteeId: 'fp-abc123', isSurrogate: true },
        { caseId: 'case-002', trusteeId: 'fp-abc123', isSurrogate: true },
      ]);
      mockGetTrusteeAppointments.mockResolvedValue([
        { status: 'active', courtId: '081', chapter: '7', divisionCodes: ['081'] },
      ]);
      vi.spyOn(CaseManagement.prototype, 'getCaseSummary').mockImplementation(
        async (_context, caseId) =>
          ({ caseId, courtId: '081', courtDivisionCode: '081', chapter: '7' }) as CaseSummary,
      );

      await useCase.approveVerification(context, 'verification-1', 'trustee-new', 'New Trustee');

      expect(mockGetSurrogatesByFingerprints).toHaveBeenCalledWith(['fp-abc123']);
      expect(mockUpdateIfPending).toHaveBeenCalledWith(
        'verification-1',
        expect.objectContaining({
          status: 'approved',
          affectedCaseIds: ['case-001', 'case-002'],
        }),
      );
    });

    test('snapshots an empty affectedCaseIds array when no surrogates remain', async () => {
      mockGetSurrogatesByFingerprints.mockResolvedValue([]);

      await useCase.approveVerification(context, 'verification-1', 'trustee-new');

      expect(mockUpdateIfPending).toHaveBeenCalledWith(
        'verification-1',
        expect.objectContaining({ affectedCaseIds: [] }),
      );
    });

    // Ordering matters here, not just outcome: surrogates must be read while still live
    // (before the remap job can delete them), and the approval + snapshot must be durably
    // persisted before the remap is enqueued, so a failed enqueue never loses the record of
    // what was approved or what cases it affected.
    test('derives affectedCaseIds, then persists the approval, then enqueues the remap message', async () => {
      const callOrder: string[] = [];
      mockGetSurrogatesByFingerprints.mockImplementation(async () => {
        callOrder.push('getSurrogatesByFingerprints');
        return [];
      });
      mockUpdateIfPending.mockImplementation(async () => {
        callOrder.push('updateIfPending');
        return true;
      });
      mockQueueTrusteeVerificationRemap.mockImplementation(async () => {
        callOrder.push('queueTrusteeVerificationRemap');
      });

      await useCase.approveVerification(context, 'verification-1', 'trustee-new');

      expect(callOrder).toEqual([
        'getSurrogatesByFingerprints',
        'updateIfPending',
        'queueTrusteeVerificationRemap',
      ]);
    });

    test('throws NotFoundError and does not enqueue the remap when a concurrent approval already won the pending transition', async () => {
      const repo = Object.assign(new MockMongoRepository(), { findById: mockFindById });
      vi.spyOn(repo, 'updateIfPending').mockResolvedValue(false);
      vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(repo);

      const attempt = useCase.approveVerification(context, 'verification-1', 'trustee-new');

      await expect(attempt).rejects.toThrow(NotFoundError);
      await expect(attempt).rejects.toThrow('Pending verification verification-1 not found.');
      expect(mockQueueTrusteeVerificationRemap).not.toHaveBeenCalled();
    });

    describe('division enforcement', () => {
      // Realistic 3-segment case IDs (not 'case-001'), so these tests exercise getCaseNumber's
      // real division-prefix-stripping logic rather than its no-op 2-segment passthrough. Error
      // messages built from these go through getCaseNumber, so they show the stripped 'yy-nnnnn'
      // form (e.g. '24-00001'), not the full case ID.
      const oneAffectedCase = [
        { caseId: '081-24-00001', trusteeId: 'fp-abc123', isSurrogate: true },
      ];
      const twoAffectedCases = [
        { caseId: '081-24-00001', trusteeId: 'fp-abc123', isSurrogate: true },
        { caseId: '081-24-00002', trusteeId: 'fp-abc123', isSurrogate: true },
      ];

      function mockCaseSummaries(byId: Record<string, Partial<CaseSummary>>) {
        vi.spyOn(CaseManagement.prototype, 'getCaseSummary').mockImplementation(
          async (_context, caseId) => ({ caseId, ...byId[caseId] }) as CaseSummary,
        );
      }

      test('approves when the resolved trustee covers every affected case court+chapter+division', async () => {
        mockGetSurrogatesByFingerprints.mockResolvedValue(twoAffectedCases);
        mockGetTrusteeAppointments.mockResolvedValue([
          { status: 'active', courtId: '081', chapter: '7', divisionCodes: ['081', '082'] },
        ]);
        mockCaseSummaries({
          '081-24-00001': { courtId: '081', courtDivisionCode: '081', chapter: '7' },
          '081-24-00002': { courtId: '081', courtDivisionCode: '082', chapter: '7' },
        });

        await useCase.approveVerification(context, 'verification-1', 'trustee-new');

        expect(mockUpdateIfPending).toHaveBeenCalledWith(
          'verification-1',
          expect.objectContaining({ status: 'approved' }),
        );
      });

      test('rejects when the resolved trustee does not cover an affected case division, and performs no writes', async () => {
        mockGetSurrogatesByFingerprints.mockResolvedValue(oneAffectedCase);
        mockGetTrusteeAppointments.mockResolvedValue([
          { status: 'active', courtId: '081', chapter: '7', divisionCodes: ['082'] },
        ]);
        mockCaseSummaries({
          '081-24-00001': { courtId: '081', courtDivisionCode: '081', chapter: '7' },
        });

        await expect(
          useCase.approveVerification(context, 'verification-1', 'trustee-new'),
        ).rejects.toThrow(BadRequestError);

        expect(mockCreateVariation).not.toHaveBeenCalled();
        expect(mockUpdateIfPending).not.toHaveBeenCalled();
        expect(mockQueueTrusteeVerificationRemap).not.toHaveBeenCalled();
      });

      test('rejection identifies the uncovered case ID in the error message', async () => {
        mockGetSurrogatesByFingerprints.mockResolvedValue(oneAffectedCase);
        mockGetTrusteeAppointments.mockResolvedValue([]);
        mockCaseSummaries({
          '081-24-00001': { courtId: '081', courtDivisionCode: '081', chapter: '7' },
        });

        await expect(
          useCase.approveVerification(context, 'verification-1', 'trustee-new'),
        ).rejects.toThrow(/24-00001/);
      });

      test('rejection names the resolved trustee by name and gives next-step guidance, rather than a raw ID', async () => {
        mockGetSurrogatesByFingerprints.mockResolvedValue(oneAffectedCase);
        mockGetTrusteeAppointments.mockResolvedValue([]);
        mockCaseSummaries({
          '081-24-00001': { courtId: '081', courtDivisionCode: '081', chapter: '7' },
        });

        await expect(
          useCase.approveVerification(context, 'verification-1', 'trustee-new', 'Jane Doe'),
        ).rejects.toThrow(
          'Jane Doe is not assigned to the division(s) for case(s): 24-00001. Choose a different candidate or search for a trustee whose appointments cover these cases.',
        );
      });

      test('rejection falls back to the resolved trustee id when no name was supplied', async () => {
        mockGetSurrogatesByFingerprints.mockResolvedValue(oneAffectedCase);
        mockGetTrusteeAppointments.mockResolvedValue([]);
        mockCaseSummaries({
          '081-24-00001': { courtId: '081', courtDivisionCode: '081', chapter: '7' },
        });

        await expect(
          useCase.approveVerification(context, 'verification-1', 'trustee-new'),
        ).rejects.toThrow(/^trustee-new is not assigned/);
      });

      test('rejects a multi-case verification when only one of several affected cases is uncovered', async () => {
        mockGetSurrogatesByFingerprints.mockResolvedValue(twoAffectedCases);
        // Covers 081-24-00001's division (081) but not 081-24-00002's (082).
        mockGetTrusteeAppointments.mockResolvedValue([
          { status: 'active', courtId: '081', chapter: '7', divisionCodes: ['081'] },
        ]);
        mockCaseSummaries({
          '081-24-00001': { courtId: '081', courtDivisionCode: '081', chapter: '7' },
          '081-24-00002': { courtId: '081', courtDivisionCode: '082', chapter: '7' },
        });

        await expect(
          useCase.approveVerification(context, 'verification-1', 'trustee-new'),
        ).rejects.toThrow(/24-00002/);

        expect(mockUpdateIfPending).not.toHaveBeenCalled();
      });

      test('rejects when the division matches but the chapter does not', async () => {
        mockGetSurrogatesByFingerprints.mockResolvedValue(oneAffectedCase);
        mockGetTrusteeAppointments.mockResolvedValue([
          { status: 'active', courtId: '081', chapter: '11', divisionCodes: ['081'] },
        ]);
        mockCaseSummaries({
          '081-24-00001': { courtId: '081', courtDivisionCode: '081', chapter: '7' },
        });

        await expect(
          useCase.approveVerification(context, 'verification-1', 'trustee-new'),
        ).rejects.toThrow(BadRequestError);
      });

      test('rejects with a distinct error (not BadRequestError) when a case lookup fails, rather than conflating it with a real division mismatch', async () => {
        mockGetSurrogatesByFingerprints.mockResolvedValue(twoAffectedCases);
        mockGetTrusteeAppointments.mockResolvedValue([
          { status: 'active', courtId: '081', chapter: '7', divisionCodes: ['081', '082'] },
        ]);
        vi.spyOn(CaseManagement.prototype, 'getCaseSummary').mockImplementation(
          async (_context, caseId) => {
            if (caseId === '081-24-00002') throw new Error('gateway timeout');
            return {
              caseId,
              courtId: '081',
              courtDivisionCode: '081',
              chapter: '7',
            } as CaseSummary;
          },
        );

        const error = await getTheThrownError(() =>
          useCase.approveVerification(context, 'verification-1', 'trustee-new'),
        );

        expect(error).not.toBeInstanceOf(BadRequestError);
        expect((error as Error).message).toContain('081-24-00002');
        expect(mockUpdateIfPending).not.toHaveBeenCalled();
      });

      test('skips the division check entirely (and never fetches trustee appointments) when there are no affected cases', async () => {
        mockGetSurrogatesByFingerprints.mockResolvedValue([]);

        await useCase.approveVerification(context, 'verification-1', 'trustee-new');

        expect(mockGetTrusteeAppointments).not.toHaveBeenCalled();
        expect(mockUpdateIfPending).toHaveBeenCalledWith(
          'verification-1',
          expect.objectContaining({ status: 'approved' }),
        );
      });

      // Guards against a large affected-case bundle firing one simultaneous DXTR query per
      // case inside a single synchronous request (reviewer-flagged on PR #3090) -- 25 cases
      // is comfortably above CASE_SUMMARY_FETCH_CONCURRENCY (10), so an unbounded fan-out
      // would push concurrent in-flight calls well past the cap this test asserts against.
      test('bounds concurrent case-summary lookups rather than firing one per affected case at once', async () => {
        const affectedCases = Array.from({ length: 25 }, (_, i) => ({
          caseId: `case-${i}`,
          trusteeId: 'fp-abc123',
          isSurrogate: true,
        }));
        mockGetSurrogatesByFingerprints.mockResolvedValue(affectedCases);
        mockGetTrusteeAppointments.mockResolvedValue([
          { status: 'active', courtId: '081', chapter: '7', divisionCodes: ['081'] },
        ]);

        let inFlight = 0;
        let maxInFlight = 0;
        vi.spyOn(CaseManagement.prototype, 'getCaseSummary').mockImplementation(
          async (_context, caseId) => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise((resolve) => setTimeout(resolve, 1));
            inFlight--;
            return {
              caseId,
              courtId: '081',
              courtDivisionCode: '081',
              chapter: '7',
            } as CaseSummary;
          },
        );

        await useCase.approveVerification(context, 'verification-1', 'trustee-new');

        expect(maxInFlight).toBeGreaterThan(0);
        expect(maxInFlight).toBeLessThanOrEqual(10);
      });
    });
  });

  describe('getEnrichedVerification', () => {
    let mockTrusteeRead: ReturnType<typeof vi.fn>;

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

      vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), { read: mockTrusteeRead }),
      );
    });

    test('returns the stored findings unchanged, without reading any trustee', async () => {
      const result = await useCase.getEnrichedVerification(context, 'verification-1');

      expect(result.findings).toEqual(sampleVerification.findings);
      expect(mockTrusteeRead).not.toHaveBeenCalled();
    });

    test('backfills resolvedTrusteeName when an approved task has none', async () => {
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
      mockGetSurrogatesByFingerprints.mockResolvedValue([
        { caseId: 'case-001', trusteeId: 'fp-abc123', isSurrogate: true },
        { caseId: 'case-002', trusteeId: 'fp-abc123', isSurrogate: true },
      ]);

      const result = await useCase.getEnrichedVerification(context, 'verification-1');

      expect(mockGetSurrogatesByFingerprints).toHaveBeenCalledWith(['fp-abc123']);
      expect(result.affectedCaseIds).toEqual(['case-001', 'case-002']);
    });

    test('returns an empty affectedCaseIds when no surrogate cases remain (resolution already in progress or complete)', async () => {
      mockGetSurrogatesByFingerprints.mockResolvedValue([]);

      const result = await useCase.getEnrichedVerification(context, 'verification-1');

      expect(result.affectedCaseIds).toEqual([]);
    });

    test('reads affectedCaseIds from the persisted snapshot for an approved verification, without querying surrogates', async () => {
      mockFindById.mockResolvedValue({
        ...sampleVerification,
        status: 'approved',
        resolvedTrusteeId: 'trustee-a',
        affectedCaseIds: ['case-001', 'case-002'],
      });

      const result = await useCase.getEnrichedVerification(context, 'verification-1');

      expect(result.affectedCaseIds).toEqual(['case-001', 'case-002']);
      expect(mockGetSurrogatesByFingerprints).not.toHaveBeenCalled();
    });

    test('falls back to an empty affectedCaseIds for an approved verification with no persisted snapshot', async () => {
      mockFindById.mockResolvedValue({
        ...sampleVerification,
        status: 'approved',
        resolvedTrusteeId: 'trustee-a',
        affectedCaseIds: undefined,
      });

      const result = await useCase.getEnrichedVerification(context, 'verification-1');

      expect(result.affectedCaseIds).toEqual([]);
    });

    test('derives affectedCaseIds live for a rejected verification rather than reading a snapshot', async () => {
      mockFindById.mockResolvedValue({
        ...sampleVerification,
        status: 'rejected',
        affectedCaseIds: undefined,
      });
      mockGetSurrogatesByFingerprints.mockResolvedValue([
        { caseId: 'case-001', trusteeId: 'fp-abc123', isSurrogate: true },
      ]);

      const result = await useCase.getEnrichedVerification(context, 'verification-1');

      expect(mockGetSurrogatesByFingerprints).toHaveBeenCalledWith(['fp-abc123']);
      expect(result.affectedCaseIds).toEqual(['case-001']);
    });

    test('logs a warning when affected case count exceeds the sanity cap', async () => {
      const manyCases = Array.from({ length: 51 }, (_, i) => ({
        caseId: `case-${i}`,
        trusteeId: 'fp-abc123',
        isSurrogate: true,
      }));
      mockGetSurrogatesByFingerprints.mockResolvedValue(manyCases);
      const warnSpy = vi.spyOn(context.logger, 'warn');

      const result = await useCase.getEnrichedVerification(context, 'verification-1');

      expect(result.affectedCaseIds).toHaveLength(51);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('fp-abc123'),
      );
    });

    test('does not log a warning when affected case count is exactly at the sanity cap', async () => {
      const exactlyCapCases = Array.from({ length: 50 }, (_, i) => ({
        caseId: `case-${i}`,
        trusteeId: 'fp-abc123',
        isSurrogate: true,
      }));
      mockGetSurrogatesByFingerprints.mockResolvedValue(exactlyCapCases);
      const warnSpy = vi.spyOn(context.logger, 'warn');

      const result = await useCase.getEnrichedVerification(context, 'verification-1');

      expect(result.affectedCaseIds).toHaveLength(50);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    test('rethrows via getCamsError when findById fails', async () => {
      mockFindById.mockRejectedValue(new Error('db unavailable'));

      await expect(useCase.getEnrichedVerification(context, 'verification-1')).rejects.toThrow();
    });
  });
});
