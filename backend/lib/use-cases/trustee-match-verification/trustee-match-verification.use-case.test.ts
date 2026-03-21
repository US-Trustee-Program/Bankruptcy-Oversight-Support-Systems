import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeMatchVerificationUseCase } from './trustee-match-verification.use-case';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { NotFoundError } from '../../common-errors/not-found-error';
import factory from '../../factory';

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
    matchCandidates: [],
    orderType: 'trustee-match',
    status: 'pending',
    createdOn: '2025-01-01T00:00:00.000Z',
    updatedOn: '2025-01-01T00:00:00.000Z',
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
  };

  const sampleSyncedCase = {
    caseId: 'case-001',
    trusteeId: 'trustee-old',
    dxtrId: 'dxtr-001',
  };

  const sampleAppointment = {
    id: 'appt-001',
    caseId: 'case-001',
    trusteeId: 'trustee-old',
    assignedOn: '2024-01-01T00:00:00.000Z',
  };

  let mockFindById: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockGetSyncedCase: ReturnType<typeof vi.fn>;
  let mockSyncDxtrCase: ReturnType<typeof vi.fn>;
  let mockGetActiveCaseAppointment: ReturnType<typeof vi.fn>;
  let mockCreateCaseAppointment: ReturnType<typeof vi.fn>;
  let mockUpdateCaseAppointment: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    useCase = new TrusteeMatchVerificationUseCase();

    mockFindById = vi.fn().mockResolvedValue(sampleVerification);
    mockUpdate = vi.fn().mockResolvedValue({ ...sampleVerification, status: 'approved' });
    mockGetSyncedCase = vi.fn().mockResolvedValue(sampleSyncedCase);
    mockSyncDxtrCase = vi.fn().mockResolvedValue(undefined);
    mockGetActiveCaseAppointment = vi.fn().mockResolvedValue(sampleAppointment);
    mockCreateCaseAppointment = vi.fn().mockResolvedValue({});
    mockUpdateCaseAppointment = vi.fn().mockResolvedValue({});

    vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        findById: mockFindById,
        update: mockUpdate,
      }),
    );
    vi.spyOn(factory, 'getCasesRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        getSyncedCase: mockGetSyncedCase,
        syncDxtrCase: mockSyncDxtrCase,
      }),
    );
    vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        getActiveCaseAppointment: mockGetActiveCaseAppointment,
        createCaseAppointment: mockCreateCaseAppointment,
        updateCaseAppointment: mockUpdateCaseAppointment,
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('approveVerification', () => {
    test('happy path: updates synced case, soft-closes old appointment, creates new, marks approved', async () => {
      await useCase.approveVerification(context, 'verification-1', 'trustee-new');

      expect(mockFindById).toHaveBeenCalledWith('verification-1');
      expect(mockSyncDxtrCase).toHaveBeenCalledWith(
        expect.objectContaining({ trusteeId: 'trustee-new' }),
      );
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
          updatedBy: expect.objectContaining({ id: expect.any(String) }),
          updatedOn: expect.any(String),
        }),
      );
    });

    test('skips syncDxtrCase when SyncedCase.trusteeId already matches', async () => {
      mockGetSyncedCase.mockResolvedValue({ ...sampleSyncedCase, trusteeId: 'trustee-new' });

      await useCase.approveVerification(context, 'verification-1', 'trustee-new');

      expect(mockSyncDxtrCase).not.toHaveBeenCalled();
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
