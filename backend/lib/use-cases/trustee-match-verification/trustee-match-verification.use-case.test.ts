import { vi, describe, test, expect, beforeEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeMatchVerificationUseCase } from './trustee-match-verification.use-case';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { NotFoundError } from '../../common-errors/not-found-error';
import factory from '../../factory';
import { ObservabilityGateway } from '../../use-cases/gateways.types';
import { CourtsUseCase } from '../courts/courts';

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
        districtDivisionScore: 100,
        chapterScore: 90,
      },
      {
        trusteeId: 'trustee-b',
        trusteeName: 'Bob',
        totalScore: 70,
        addressScore: 60,
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
  };

  const sampleAppointment = {
    id: 'appt-001',
    caseId: 'case-001',
    trusteeId: 'trustee-old',
    assignedOn: '2024-01-01T00:00:00.000Z',
  };

  let mockFindById: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockGetActiveCaseAppointment: ReturnType<typeof vi.fn>;
  let mockCreateCaseAppointment: ReturnType<typeof vi.fn>;
  let mockUpdateCaseAppointment: ReturnType<typeof vi.fn>;
  let mockCreateProfessionalId: ReturnType<typeof vi.fn>;
  let mockCompleteTrace: ObservabilityGateway['completeTrace'];

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    mockCompleteTrace = vi.fn();
    vi.spyOn(context.observability, 'completeTrace').mockImplementation(mockCompleteTrace);
    useCase = new TrusteeMatchVerificationUseCase();

    mockFindById = vi.fn().mockResolvedValue(sampleVerification);
    mockUpdate = vi.fn().mockResolvedValue({ ...sampleVerification, status: 'approved' });
    mockGetActiveCaseAppointment = vi.fn().mockResolvedValue(sampleAppointment);
    mockCreateCaseAppointment = vi.fn().mockResolvedValue({});
    mockUpdateCaseAppointment = vi.fn().mockResolvedValue({});
    mockCreateProfessionalId = vi.fn().mockResolvedValue({});

    vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        findById: mockFindById,
        update: mockUpdate,
      }),
    );
    vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        getActiveByCaseId: mockGetActiveCaseAppointment,
        upsert: mockCreateCaseAppointment,
        updateCaseAppointment: mockUpdateCaseAppointment,
      }),
    );
    vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        createProfessionalId: mockCreateProfessionalId,
      }),
    );
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
  });

  describe('approveVerification', () => {
    test('happy path: updates synced case, soft-closes old appointment, creates new, marks approved', async () => {
      await useCase.approveVerification(context, 'verification-1', 'trustee-new', 'New Trustee');

      expect(mockFindById).toHaveBeenCalledWith('verification-1');
      expect(mockUpdateCaseAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ unassignedOn: expect.any(String) }),
      );
      expect(mockCreateCaseAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ caseId: 'case-001', trusteeId: 'trustee-new' }),
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

    test('skips updateCaseAppointment and createCaseAppointment when existing appointment has same trustee', async () => {
      mockGetActiveCaseAppointment.mockResolvedValue({
        ...sampleAppointment,
        trusteeId: 'trustee-new',
      });

      await useCase.approveVerification(context, 'verification-1', 'trustee-new');

      expect(mockUpdateCaseAppointment).not.toHaveBeenCalled();
      expect(mockCreateCaseAppointment).not.toHaveBeenCalled();
    });

    test('creates new appointment but skips soft-close when no existing appointment', async () => {
      mockGetActiveCaseAppointment.mockResolvedValue(null);

      await useCase.approveVerification(context, 'verification-1', 'trustee-new');

      expect(mockUpdateCaseAppointment).not.toHaveBeenCalled();
      expect(mockCreateCaseAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ caseId: 'case-001', trusteeId: 'trustee-new' }),
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

    test('writes appointedDate from the verification doc, not the approval timestamp', async () => {
      mockFindById.mockResolvedValue({
        ...sampleVerification,
        appointedDate: '2025-06-01',
      });

      await useCase.approveVerification(context, 'verification-1', 'trustee-new');

      expect(mockCreateCaseAppointment).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'case-001',
          trusteeId: 'trustee-new',
          assignedOn: expect.any(String),
          appointedDate: '2025-06-01',
        }),
      );
      const upsertArg = mockCreateCaseAppointment.mock.calls[0][0];
      expect(upsertArg.appointedDate).not.toBe(upsertArg.assignedOn);
    });

    test('leaves appointedDate undefined when the verification doc has none', async () => {
      await useCase.approveVerification(context, 'verification-1', 'trustee-new');

      expect(mockCreateCaseAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ appointedDate: undefined }),
      );
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
