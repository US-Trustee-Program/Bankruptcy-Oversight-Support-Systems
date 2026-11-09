import { vi, describe, test, expect, beforeEach, Mock } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeMatchVerificationUseCase } from './trustee-match-verification.use-case';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { NotFoundError } from '../../common-errors/not-found-error';
import { BadRequestError } from '../../common-errors/bad-request';
import { CamsError } from '../../common-errors/cams-error';
import factory from '../../factory';
import { ObservabilityGateway } from '../../use-cases/gateways.types';
import { CourtsUseCase } from '../courts/courts';
import CaseManagement from '../cases/case-management';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { TrusteeVerificationRemapMessage } from '@common/cams/dataflow-events';
import MockData from '@common/cams/test-utilities/mock-data';

/** A fresh MockMongoRepository with the given methods overridden by mocks. */
function mockRepo<T extends object>(overrides: T) {
  return Object.assign(new MockMongoRepository(), overrides);
}

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
    sourceTrustee: { fullName: 'John Doe' },
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

  const courtFields081 = { courtId: '081', courtDivisionCode: '081', chapter: '7' as const };

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
      mockRepo({
        getSurrogatesByFingerprints: mockGetSurrogatesByFingerprints,
      }),
    );
    vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
      mockRepo({
        getTrusteeAppointments: mockGetTrusteeAppointments,
      }),
    );
    vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
      mockRepo({
        findById: mockFindById,
        updateIfPending: mockUpdateIfPending,
      }),
    );
    vi.spyOn(factory, 'getTrusteeVariationRepository').mockReturnValue(
      mockRepo({
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
        mockRepo({
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

    test('counts a case once when it holds more than one placeholder for the same fingerprint', async () => {
      mockGetSurrogatesByFingerprints.mockResolvedValue([
        { caseId: 'case-001', trusteeId: 'fp-abc123', isSurrogate: true, assignedOn: '2026-01-01' },
        { caseId: 'case-001', trusteeId: 'fp-abc123', isSurrogate: true, assignedOn: '2026-03-01' },
      ]);

      const result = await useCase.getVerifications(context, {});

      expect(result[0].affectedCaseCount).toBe(1);
      expect(result[0].affectedCaseIds).toEqual(['case-001']);
    });

    test('counts each case once per fingerprint across cases, keeping separate cases distinct', async () => {
      mockGetSurrogatesByFingerprints.mockResolvedValue([
        { caseId: 'case-001', trusteeId: 'fp-abc123', isSurrogate: true, assignedOn: '2026-01-01' },
        { caseId: 'case-001', trusteeId: 'fp-abc123', isSurrogate: true, assignedOn: '2026-03-01' },
        { caseId: 'case-002', trusteeId: 'fp-abc123', isSurrogate: true, assignedOn: '2026-01-01' },
      ]);

      const result = await useCase.getVerifications(context, {});

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
        { caseId: 'case-001', trusteeId: 'fp-abc123', isSurrogate: true, ...courtFields081 },
        { caseId: 'case-002', trusteeId: 'fp-abc123', isSurrogate: true, ...courtFields081 },
      ]);
      mockGetTrusteeAppointments.mockResolvedValue([
        { status: 'active', courtId: '081', chapter: '7', divisionCodes: ['081'] },
      ]);

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

    // Ordering matters here, not just outcome: surrogates must be read while still live (before
    // the remap job can delete them) and the approval + snapshot must be durably persisted before
    // the remap is enqueued, so a failed enqueue never loses the record of what was approved or
    // what cases it affected. Proven above by outcome rather than instrumented call order:
    // 'snapshots affectedCaseIds onto the same update call that sets status approved' shows the
    // surrogate-derived values reach the persisted update, and 'persists the approval and
    // snapshot even when the remap enqueue fails afterward' shows the persist already completed
    // by the time a failing enqueue is reached.

    test('throws NotFoundError and does not enqueue the remap when a concurrent approval already won the pending transition', async () => {
      const repo = mockRepo({ findById: mockFindById });
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
      // form (e.g. '24-00001'), not the full case ID. Coverage is decided from the court fields
      // stored on each placeholder row (epic decision 14), never from a DXTR case lookup.
      function placeholder(caseId: string, fields: Partial<CaseAppointment> = courtFields081) {
        return { caseId, trusteeId: 'fp-abc123', isSurrogate: true, ...fields };
      }

      test('approves when the resolved trustee covers every affected case court+chapter+division', async () => {
        mockGetSurrogatesByFingerprints.mockResolvedValue([
          placeholder('081-24-00001'),
          placeholder('081-24-00002', { ...courtFields081, courtDivisionCode: '082' }),
        ]);
        mockGetTrusteeAppointments.mockResolvedValue([
          { status: 'active', courtId: '081', chapter: '7', divisionCodes: ['081', '082'] },
        ]);
        // A case not yet in CAMS has no DXTR case summary; coverage must come from the rows alone.
        vi.spyOn(CaseManagement.prototype, 'getCaseSummary').mockRejectedValue(
          new Error('case not found'),
        );

        await useCase.approveVerification(context, 'verification-1', 'trustee-new');

        expect(mockUpdateIfPending).toHaveBeenCalledWith(
          'verification-1',
          expect.objectContaining({ status: 'approved' }),
        );
      });

      test('rejects when the resolved trustee does not cover an affected case division, and performs no writes', async () => {
        mockGetSurrogatesByFingerprints.mockResolvedValue([placeholder('081-24-00001')]);
        mockGetTrusteeAppointments.mockResolvedValue([
          { status: 'active', courtId: '081', chapter: '7', divisionCodes: ['082'] },
        ]);

        await expect(
          useCase.approveVerification(context, 'verification-1', 'trustee-new'),
        ).rejects.toThrow(BadRequestError);

        expect(mockCreateVariation).not.toHaveBeenCalled();
        expect(mockUpdateIfPending).not.toHaveBeenCalled();
        expect(mockQueueTrusteeVerificationRemap).not.toHaveBeenCalled();
      });

      test('rejection identifies the uncovered case ID in the error message', async () => {
        mockGetSurrogatesByFingerprints.mockResolvedValue([placeholder('081-24-00001')]);
        mockGetTrusteeAppointments.mockResolvedValue([]);

        await expect(
          useCase.approveVerification(context, 'verification-1', 'trustee-new'),
        ).rejects.toThrow(/24-00001/);
      });

      test('rejection names the resolved trustee by name and gives next-step guidance, rather than a raw ID', async () => {
        mockGetSurrogatesByFingerprints.mockResolvedValue([placeholder('081-24-00001')]);
        mockGetTrusteeAppointments.mockResolvedValue([]);

        await expect(
          useCase.approveVerification(context, 'verification-1', 'trustee-new', 'Jane Doe'),
        ).rejects.toThrow(
          'Jane Doe is not assigned to the division(s) for case(s): 24-00001. Choose a different candidate or search for a trustee whose appointments cover these cases.',
        );
      });

      test('rejection falls back to the resolved trustee id when no name was supplied', async () => {
        mockGetSurrogatesByFingerprints.mockResolvedValue([placeholder('081-24-00001')]);
        mockGetTrusteeAppointments.mockResolvedValue([]);

        await expect(
          useCase.approveVerification(context, 'verification-1', 'trustee-new'),
        ).rejects.toThrow(/^trustee-new is not assigned/);
      });

      test('rejects a multi-case verification when only one of several affected cases is uncovered', async () => {
        mockGetSurrogatesByFingerprints.mockResolvedValue([
          placeholder('081-24-00001'),
          placeholder('081-24-00002', { ...courtFields081, courtDivisionCode: '082' }),
        ]);
        // Covers 081-24-00001's division (081) but not 081-24-00002's (082).
        mockGetTrusteeAppointments.mockResolvedValue([
          { status: 'active', courtId: '081', chapter: '7', divisionCodes: ['081'] },
        ]);

        await expect(
          useCase.approveVerification(context, 'verification-1', 'trustee-new'),
        ).rejects.toThrow(/24-00002/);

        expect(mockUpdateIfPending).not.toHaveBeenCalled();
      });

      test('rejects when the division matches but the chapter does not', async () => {
        mockGetSurrogatesByFingerprints.mockResolvedValue([placeholder('081-24-00001')]);
        mockGetTrusteeAppointments.mockResolvedValue([
          { status: 'active', courtId: '081', chapter: '11', divisionCodes: ['081'] },
        ]);

        await expect(
          useCase.approveVerification(context, 'verification-1', 'trustee-new'),
        ).rejects.toThrow(BadRequestError);
      });

      test.each([['courtId'], ['courtDivisionCode'], ['chapter']])(
        'treats a placeholder row with no %s as uncovered and names its case once',
        async (missingField) => {
          const incomplete = { ...courtFields081 };
          delete incomplete[missingField as keyof typeof incomplete];
          mockGetSurrogatesByFingerprints.mockResolvedValue([
            placeholder('081-24-00001', incomplete),
            placeholder('081-24-00001', incomplete),
          ]);
          mockGetTrusteeAppointments.mockResolvedValue([
            { status: 'active', courtId: '081', chapter: '7', divisionCodes: ['081'] },
          ]);

          await expect(
            useCase.approveVerification(context, 'verification-1', 'trustee-new'),
          ).rejects.toThrow(/case\(s\): 24-00001\. Choose/);
          expect(mockUpdateIfPending).not.toHaveBeenCalled();
        },
      );

      test('a case is uncovered when any one of its placeholder rows is, and is named once', async () => {
        const { courtDivisionCode: _omitted, ...missingDivision } = courtFields081;
        mockGetSurrogatesByFingerprints.mockResolvedValue([
          placeholder('081-24-00001'),
          placeholder('081-24-00001', missingDivision),
        ]);
        mockGetTrusteeAppointments.mockResolvedValue([
          { status: 'active', courtId: '081', chapter: '7', divisionCodes: ['081'] },
        ]);

        const error = await useCase
          .approveVerification(context, 'verification-1', 'trustee-new')
          .catch((e: Error) => e);

        expect(error).toBeInstanceOf(BadRequestError);
        expect((error as Error).message.match(/24-00001/g)).toHaveLength(1);
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
    });

    describe('ACMS professional id linking', () => {
      const acmsProfessionalId = 'NY-00063';
      const systemUser = { id: 'SYSTEM', name: 'SYSTEM' };
      let professionalIdsRepo: MockMongoRepository;

      function seedProfessionalId(
        camsTrusteeId: string,
        disposition: 'linked' | 'no-match' | 'ambiguous' | 'skipped',
        options: { acmsId?: string; variant?: string } = {},
      ) {
        return professionalIdsRepo.upsertProfessionalId(
          {
            documentType: 'TRUSTEE_PROFESSIONAL_ID',
            camsTrusteeId,
            acmsProfessionalId: options.acmsId ?? acmsProfessionalId,
            disposition,
            nameMatchCount: 0,
            evidence: { ...MockData.getTrusteeMatchFindings(), variant: options.variant },
          },
          systemUser,
        );
      }

      // An unresolved record of another ACMS id whose source record has the same contact data,
      // so it shares this task's fingerprint and variant.
      function seedSharedFingerprintRecord(
        acmsId: string,
        disposition: 'no-match' | 'ambiguous' | 'skipped' = 'no-match',
        variant: string = sampleVerification.variant,
      ) {
        return seedProfessionalId(sampleVerification.fingerprint, disposition, { acmsId, variant });
      }

      beforeEach(() => {
        professionalIdsRepo = new MockMongoRepository();
        vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
          professionalIdsRepo,
        );
        mockFindById.mockResolvedValue({ ...sampleVerification, acmsProfessionalId });
      });

      test('links the ACMS professional id to the approved trustee with the reviewed findings as evidence', async () => {
        const upsertSpy = vi.spyOn(professionalIdsRepo, 'upsertProfessionalId');

        await useCase.approveVerification(context, 'verification-1', 'trustee-b');

        expect(upsertSpy).toHaveBeenCalledWith(
          {
            documentType: 'TRUSTEE_PROFESSIONAL_ID',
            camsTrusteeId: 'trustee-b',
            acmsProfessionalId,
            disposition: 'linked',
            linkMethod: 'manual',
            nameMatchCount: 2,
            evidence: {
              ...sampleVerification.findings,
              match: { trusteeId: 'trustee-b', score: {}, resolvedBy: 'manualApproval' },
              variant: sampleVerification.variant,
            },
          },
          expect.objectContaining({ id: expect.any(String) }),
        );
        const links = await professionalIdsRepo.findByAcmsProfessionalId(acmsProfessionalId);
        expect(links.map((link) => link.camsTrusteeId)).toEqual(['trustee-b']);
      });

      test("removes this ACMS id's fingerprint-keyed unresolved record", async () => {
        await seedProfessionalId(sampleVerification.fingerprint, 'linked');

        await useCase.approveVerification(context, 'verification-1', 'trustee-b');

        const remaining = await professionalIdsRepo.findByCamsTrusteeId(
          sampleVerification.fingerprint,
        );
        expect(remaining).toEqual([]);
      });

      test.each(['no-match', 'ambiguous'] as const)(
        'links another ACMS id that shares the fingerprint and variant (%s) to the approved trustee as manual',
        async (disposition) => {
          await seedProfessionalId(sampleVerification.fingerprint, 'no-match');
          await seedSharedFingerprintRecord('UT-05321', disposition);
          const upsertSpy = vi.spyOn(professionalIdsRepo, 'upsertProfessionalId');

          await useCase.approveVerification(context, 'verification-1', 'trustee-b');

          expect(upsertSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              camsTrusteeId: 'trustee-b',
              acmsProfessionalId: 'UT-05321',
              disposition: 'linked',
              linkMethod: 'manual',
              evidence: expect.objectContaining({
                match: { trusteeId: 'trustee-b', score: {}, resolvedBy: 'manualApproval' },
                variant: sampleVerification.variant,
              }),
            }),
            expect.objectContaining({ id: expect.any(String) }),
          );
          const links = await professionalIdsRepo.findByAcmsProfessionalId('UT-05321');
          expect(links.map((link) => link.camsTrusteeId)).toEqual(['trustee-b']);
          expect(
            await professionalIdsRepo.findUnresolvedByFingerprint(sampleVerification.fingerprint),
          ).toEqual([]);
        },
      );

      test('links several other ACMS ids that share the fingerprint', async () => {
        await seedProfessionalId(sampleVerification.fingerprint, 'no-match');
        await seedSharedFingerprintRecord('UT-05321');
        await seedSharedFingerprintRecord('CA-00012', 'ambiguous');

        await useCase.approveVerification(context, 'verification-1', 'trustee-b');

        const linked = await professionalIdsRepo.findByCamsTrusteeId('trustee-b');
        expect(linked.map((link) => link.acmsProfessionalId).sort()).toEqual([
          'CA-00012',
          'NY-00063',
          'UT-05321',
        ]);
      });

      test('leaves an unresolved record whose stored variant differs from the approved variant', async () => {
        await seedSharedFingerprintRecord('UT-05321', 'no-match', 'a different variant');

        await useCase.approveVerification(context, 'verification-1', 'trustee-b');

        expect(await professionalIdsRepo.findByAcmsProfessionalId('UT-05321')).toEqual([]);
        const unresolved = await professionalIdsRepo.findUnresolvedByFingerprint(
          sampleVerification.fingerprint,
        );
        expect(unresolved.map((record) => record.acmsProfessionalId)).toEqual(['UT-05321']);
      });

      test('does not move a link another ACMS id already has on a different trustee', async () => {
        await seedSharedFingerprintRecord('UT-05321');
        await seedProfessionalId('trustee-old', 'linked', { acmsId: 'UT-05321' });

        await useCase.approveVerification(context, 'verification-1', 'trustee-b');

        const links = await professionalIdsRepo.findByAcmsProfessionalId('UT-05321');
        expect(links.map((link) => link.camsTrusteeId)).toEqual(['trustee-old']);
      });

      test('ignores a record keyed by the fingerprint that is neither no-match nor ambiguous', async () => {
        await seedSharedFingerprintRecord('UT-05321', 'skipped');

        await useCase.approveVerification(context, 'verification-1', 'trustee-b');

        expect(await professionalIdsRepo.findByAcmsProfessionalId('UT-05321')).toEqual([]);
      });

      test('fails the approval, leaving it pending, when linking another ACMS id throws', async () => {
        await seedSharedFingerprintRecord('UT-05321');
        vi.spyOn(professionalIdsRepo, 'upsertProfessionalId')
          .mockResolvedValueOnce({} as never)
          .mockRejectedValueOnce(new CamsError('TEST', { message: 'sibling write failed' }));

        await expect(
          useCase.approveVerification(context, 'verification-1', 'trustee-b'),
        ).rejects.toThrow('sibling write failed');

        expect(mockUpdateIfPending).not.toHaveBeenCalled();
      });

      test('moves an existing link on a different trustee to the approved trustee', async () => {
        await seedProfessionalId('trustee-old', 'linked');

        await useCase.approveVerification(context, 'verification-1', 'trustee-b');

        const links = await professionalIdsRepo.findByAcmsProfessionalId(acmsProfessionalId);
        expect(links.map((link) => link.camsTrusteeId)).toEqual(['trustee-b']);
      });

      test('keeps an existing link that is already on the approved trustee', async () => {
        await seedProfessionalId('trustee-b', 'linked');

        await useCase.approveVerification(context, 'verification-1', 'trustee-b');

        const links = await professionalIdsRepo.findByAcmsProfessionalId(acmsProfessionalId);
        expect(links).toEqual([
          expect.objectContaining({ camsTrusteeId: 'trustee-b', createdBy: systemUser }),
        ]);
      });

      test.each([
        { method: 'findByAcmsProfessionalId' as const },
        { method: 'deleteLink' as const },
      ])(
        'fails the approval without writing the new link when $method throws',
        async ({ method }) => {
          await seedProfessionalId('trustee-old', 'linked');
          vi.spyOn(professionalIdsRepo, method).mockRejectedValue(
            new CamsError('TEST', { message: 'write failed' }),
          );
          const upsertSpy = vi.spyOn(professionalIdsRepo, 'upsertProfessionalId');

          await expect(
            useCase.approveVerification(context, 'verification-1', 'trustee-b'),
          ).rejects.toThrow('write failed');

          expect(upsertSpy).not.toHaveBeenCalled();
          const links = await professionalIdsRepo.findByCamsTrusteeId('trustee-old');
          expect(links).toHaveLength(1);
          expect(mockUpdateIfPending).not.toHaveBeenCalled();
        },
      );

      test('fails the approval and keeps the fingerprint-keyed records when writing the new link throws', async () => {
        vi.spyOn(professionalIdsRepo, 'upsertProfessionalId').mockRejectedValue(
          new CamsError('TEST', { message: 'write failed' }),
        );
        const deleteLinkSpy = vi.spyOn(professionalIdsRepo, 'deleteLink');

        await expect(
          useCase.approveVerification(context, 'verification-1', 'trustee-b'),
        ).rejects.toThrow('write failed');

        expect(deleteLinkSpy).not.toHaveBeenCalledWith(
          sampleVerification.fingerprint,
          acmsProfessionalId,
        );
        expect(mockUpdateIfPending).not.toHaveBeenCalled();
      });

      test('still approves and logs when the fingerprint-keyed cleanup throws', async () => {
        vi.spyOn(professionalIdsRepo, 'deleteLink').mockRejectedValue(new Error('delete failed'));
        const loggerWarnSpy = vi.spyOn(context.logger, 'warn');

        await useCase.approveVerification(context, 'verification-1', 'trustee-b');

        expect(loggerWarnSpy).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining(sampleVerification.fingerprint),
          expect.any(Error),
        );
        expect(mockUpdateIfPending).toHaveBeenCalled();
        expect(mockQueueTrusteeVerificationRemap).toHaveBeenCalled();
        const links = await professionalIdsRepo.findByAcmsProfessionalId(acmsProfessionalId);
        expect(links.map((link) => link.camsTrusteeId)).toEqual(['trustee-b']);
      });

      test('makes no professional-id calls when the verification has no ACMS professional id', async () => {
        mockFindById.mockResolvedValue(sampleVerification);
        const spies = [
          vi.spyOn(professionalIdsRepo, 'findByAcmsProfessionalId'),
          vi.spyOn(professionalIdsRepo, 'findUnresolvedByFingerprint'),
          vi.spyOn(professionalIdsRepo, 'deleteLink'),
          vi.spyOn(professionalIdsRepo, 'upsertProfessionalId'),
        ];

        await useCase.approveVerification(context, 'verification-1', 'trustee-b');

        spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
        expect(mockUpdateIfPending).toHaveBeenCalled();
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
        mockRepo({ read: mockTrusteeRead }),
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
