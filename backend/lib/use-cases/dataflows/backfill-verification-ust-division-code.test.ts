import { beforeAll, beforeEach, describe, test, expect, vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import BackfillVerificationUstDivisionCodeUseCase from './backfill-verification-ust-division-code';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { SyncedCase } from '@common/cams/cases';

type BackfillVerification = TrusteeMatchVerification & { _id: string };

function makeVerification(override: Partial<TrusteeMatchVerification> = {}): BackfillVerification {
  const base: TrusteeMatchVerification = {
    id: `verify-${Math.random().toString(36).slice(2)}`,
    documentType: 'TRUSTEE_MATCH_VERIFICATION',
    caseId: '491-25-12345',
    courtId: '0649',
    dxtrTrustee: { fullName: 'Test Trustee' },
    matchCandidates: [],
    taskType: 'trustee-match',
    status: 'pending',
    createdOn: '2025-03-10T00:00:00.000Z',
    updatedOn: '2025-03-15T00:00:00.000Z',
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
    taskDate: '2025-03-10T00:00:00.000Z',
    fingerprint: 'fp-abc123',
    variant: '{"firstName":"test","lastName":"trustee"}',
    ...override,
  };
  return { ...base, _id: base.id };
}

function makeSyncedCase(override: Partial<SyncedCase> = {}): SyncedCase {
  return {
    caseId: '491-25-12345',
    courtId: '0649',
    courtDivisionCode: '491',
    ustDivisionCode: '494',
    chapter: '7',
    dateFiled: '2025-01-07',
    ...override,
  } as SyncedCase;
}

describe('BackfillVerificationUstDivisionCodeUseCase', () => {
  let context: ApplicationContext;

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPageNeedingBackfill', () => {
    test('should return a page of verifications missing ustDivisionCode', async () => {
      const verification = makeVerification();

      vi.spyOn(
        MockMongoRepository.prototype,
        'findVerificationsMissingUstDivisionCode',
      ).mockResolvedValue([verification]);

      const result = await BackfillVerificationUstDivisionCodeUseCase.getPageNeedingBackfill(
        context,
        null,
        100,
      );

      expect(result.error).toBeUndefined();
      expect(result.data?.verifications.length).toBe(1);
      expect(result.data?.hasMore).toBe(false);
      expect(result.data?.lastId).toBe(verification._id);
    });

    test('should report hasMore and trim the extra lookahead document', async () => {
      const first = makeVerification();
      const second = makeVerification();

      vi.spyOn(
        MockMongoRepository.prototype,
        'findVerificationsMissingUstDivisionCode',
      ).mockResolvedValue([first, second]);

      const result = await BackfillVerificationUstDivisionCodeUseCase.getPageNeedingBackfill(
        context,
        null,
        1,
      );

      expect(result.data?.verifications.length).toBe(1);
      expect(result.data?.hasMore).toBe(true);
      expect(result.data?.lastId).toBe(first._id);
    });

    test('should return an error when the query fails', async () => {
      vi.spyOn(
        MockMongoRepository.prototype,
        'findVerificationsMissingUstDivisionCode',
      ).mockRejectedValue(new Error('query failed'));

      const result = await BackfillVerificationUstDivisionCodeUseCase.getPageNeedingBackfill(
        context,
        'cursor-1',
        100,
      );

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('backfillUstDivisionCodes', () => {
    test('should copy ustDivisionCode from the verification own synced case', async () => {
      const verification = makeVerification();
      vi.spyOn(MockMongoRepository.prototype, 'getCaseOrMovedCase').mockResolvedValue(
        makeSyncedCase(),
      );
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateVerificationUstDivisionCode')
        .mockResolvedValue();

      const result = await BackfillVerificationUstDivisionCodeUseCase.backfillUstDivisionCodes(
        context,
        [verification],
      );

      expect(updateSpy).toHaveBeenCalledWith(verification._id, '494');
      expect(result.data).toEqual([{ id: verification._id, success: true }]);
    });

    // Deriving the code from the caseId prefix is what cannot tell Winchester from Chattanooga in
    // the first place, so a case the case-level backfill has not reached yet must be left alone
    // rather than stamped with the ACMS code.
    test('should skip rather than guess when the synced case has no ustDivisionCode', async () => {
      const verification = makeVerification();
      vi.spyOn(MockMongoRepository.prototype, 'getCaseOrMovedCase').mockResolvedValue(
        makeSyncedCase({ ustDivisionCode: undefined }),
      );
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateVerificationUstDivisionCode')
        .mockResolvedValue();

      const result = await BackfillVerificationUstDivisionCodeUseCase.backfillUstDivisionCodes(
        context,
        [verification],
      );

      expect(updateSpy).not.toHaveBeenCalled();
      expect(result.data).toEqual([{ id: verification._id, success: true, skipped: true }]);
    });

    test('should skip when the case is not synced into CAMS at all', async () => {
      const verification = makeVerification();
      vi.spyOn(MockMongoRepository.prototype, 'getCaseOrMovedCase').mockResolvedValue(null);
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateVerificationUstDivisionCode')
        .mockResolvedValue();

      const result = await BackfillVerificationUstDivisionCodeUseCase.backfillUstDivisionCodes(
        context,
        [verification],
      );

      expect(updateSpy).not.toHaveBeenCalled();
      expect(result.data?.[0].skipped).toBe(true);
    });

    test('should record a failure and keep going when one write throws', async () => {
      const failing = makeVerification({ caseId: '491-25-00001' });
      const succeeding = makeVerification({ caseId: '491-25-00002' });
      vi.spyOn(MockMongoRepository.prototype, 'getCaseOrMovedCase').mockResolvedValue(
        makeSyncedCase(),
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateVerificationUstDivisionCode')
        .mockRejectedValueOnce(new Error('write failed'))
        .mockResolvedValueOnce();

      const result = await BackfillVerificationUstDivisionCodeUseCase.backfillUstDivisionCodes(
        context,
        [failing, succeeding],
      );

      expect(result.data).toEqual([
        { id: failing._id, success: false, error: 'write failed' },
        { id: succeeding._id, success: true },
      ]);
    });
  });

  describe('processBackfillPage', () => {
    test('should return empty when no verifications need backfilling', async () => {
      vi.spyOn(
        MockMongoRepository.prototype,
        'findVerificationsMissingUstDivisionCode',
      ).mockResolvedValue([]);

      const result = await BackfillVerificationUstDivisionCodeUseCase.processBackfillPage(
        context,
        null,
        100,
      );

      expect(result.status).toBe('empty');
    });

    test('should return an error when the page query fails', async () => {
      vi.spyOn(
        MockMongoRepository.prototype,
        'findVerificationsMissingUstDivisionCode',
      ).mockRejectedValue(new Error('query failed'));

      const result = await BackfillVerificationUstDivisionCodeUseCase.processBackfillPage(
        context,
        null,
        100,
      );

      expect(result.status).toBe('error');
    });

    test('should count successes and skips separately and stop on the last page', async () => {
      const backfilled = makeVerification({ caseId: '491-25-00001' });
      const notYetBackfilled = makeVerification({ caseId: '491-25-00002' });

      vi.spyOn(
        MockMongoRepository.prototype,
        'findVerificationsMissingUstDivisionCode',
      ).mockResolvedValue([backfilled, notYetBackfilled]);
      vi.spyOn(MockMongoRepository.prototype, 'getCaseOrMovedCase')
        .mockResolvedValueOnce(makeSyncedCase())
        .mockResolvedValueOnce(makeSyncedCase({ ustDivisionCode: undefined }));
      vi.spyOn(
        MockMongoRepository.prototype,
        'updateVerificationUstDivisionCode',
      ).mockResolvedValue();

      const result = await BackfillVerificationUstDivisionCodeUseCase.processBackfillPage(
        context,
        null,
        100,
      );

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.processedCount).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(result.failedResults).toHaveLength(0);
      expect(result.nextCursor).toBeNull();
    });

    // A skipped verification keeps the field absent, so it stays selected by the page query.
    // If the cursor did not move past it the run would re-read the same page forever.
    test('should advance the cursor past a page that was entirely skipped', async () => {
      const first = makeVerification({ caseId: '491-25-00001' });
      const second = makeVerification({ caseId: '491-25-00002' });

      vi.spyOn(
        MockMongoRepository.prototype,
        'findVerificationsMissingUstDivisionCode',
      ).mockResolvedValue([first, second]);
      vi.spyOn(MockMongoRepository.prototype, 'getCaseOrMovedCase').mockResolvedValue(
        makeSyncedCase({ ustDivisionCode: undefined }),
      );

      const result = await BackfillVerificationUstDivisionCodeUseCase.processBackfillPage(
        context,
        null,
        1,
      );

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.skippedCount).toBe(1);
      expect(result.nextCursor).toEqual({ lastId: first._id });
    });
  });
});
