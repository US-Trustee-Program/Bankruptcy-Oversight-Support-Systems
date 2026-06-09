import { beforeAll, beforeEach, describe, test, expect, vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import BackfillTrusteeVerificationTaskDateUseCase from './backfill-trustee-verification-task-date';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';

type BackfillVerification = TrusteeMatchVerification & { _id: string };

function makeVerification(override: Partial<TrusteeMatchVerification> = {}): BackfillVerification {
  const base: TrusteeMatchVerification = {
    id: `verify-${Math.random().toString(36).slice(2)}`,
    documentType: 'TRUSTEE_MATCH_VERIFICATION',
    caseId: '081-25-12345',
    courtId: '081',
    dxtrTrustee: { fullName: 'Test Trustee' },
    matchCandidates: [],
    orderType: 'trustee-match',
    status: 'pending',
    createdOn: '2025-03-10T00:00:00.000Z',
    updatedOn: '2025-03-15T00:00:00.000Z',
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
    taskDate: '2025-03-10T00:00:00.000Z',
    ...override,
  };
  return { ...base, _id: base.id };
}

describe('BackfillTrusteeVerificationTaskDateUseCase', () => {
  let context: ApplicationContext;

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPageNeedingBackfill', () => {
    test('should return a page of verifications missing taskDate', async () => {
      const verification = makeVerification();

      vi.spyOn(MockMongoRepository.prototype, 'findVerificationsMissingTaskDate').mockResolvedValue(
        [verification],
      );

      const result = await BackfillTrusteeVerificationTaskDateUseCase.getPageNeedingBackfill(
        context,
        null,
        100,
      );

      expect(result.error).toBeUndefined();
      expect(result.data?.verifications.length).toBe(1);
      expect(result.data?.verifications[0]._id).toBe(verification._id);
      expect(result.data?.hasMore).toBe(false);
      expect(result.data?.lastId).toBe(verification._id);
    });

    test('should detect hasMore when results exceed limit', async () => {
      const v1 = makeVerification();
      const v2 = makeVerification();

      vi.spyOn(MockMongoRepository.prototype, 'findVerificationsMissingTaskDate').mockResolvedValue(
        [v1, v2],
      );

      const result = await BackfillTrusteeVerificationTaskDateUseCase.getPageNeedingBackfill(
        context,
        null,
        1,
      );

      expect(result.data?.verifications.length).toBe(1);
      expect(result.data?.hasMore).toBe(true);
      expect(result.data?.lastId).toBe(v1._id);
    });

    test('should return empty page when no verifications found', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findVerificationsMissingTaskDate').mockResolvedValue(
        [],
      );

      const result = await BackfillTrusteeVerificationTaskDateUseCase.getPageNeedingBackfill(
        context,
        'some-cursor',
        100,
      );

      expect(result.error).toBeUndefined();
      expect(result.data?.verifications.length).toBe(0);
      expect(result.data?.hasMore).toBe(false);
      expect(result.data?.lastId).toBeNull();
    });

    test('should return error when repo call fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findVerificationsMissingTaskDate').mockRejectedValue(
        new Error('Database error'),
      );

      const result = await BackfillTrusteeVerificationTaskDateUseCase.getPageNeedingBackfill(
        context,
        null,
        100,
      );

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('backfillTaskDates', () => {
    test('should set taskDate from createdOn when present', async () => {
      const verification = makeVerification({
        createdOn: '2025-03-10T00:00:00.000Z',
        updatedOn: '2025-03-15T00:00:00.000Z',
      });
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateVerificationTaskDate')
        .mockResolvedValue();

      const result = await BackfillTrusteeVerificationTaskDateUseCase.backfillTaskDates(context, [
        verification,
      ]);

      expect(result.error).toBeUndefined();
      expect(result.data?.[0].success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(verification._id, '2025-03-10T00:00:00.000Z');
    });

    test('should fallback to updatedOn when createdOn is missing', async () => {
      const verification = makeVerification({ updatedOn: '2025-03-20T00:00:00.000Z' });
      delete (verification as Partial<TrusteeMatchVerification>).createdOn;
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateVerificationTaskDate')
        .mockResolvedValue();

      const result = await BackfillTrusteeVerificationTaskDateUseCase.backfillTaskDates(context, [
        verification,
      ]);

      expect(result.error).toBeUndefined();
      expect(result.data?.[0].success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(verification._id, '2025-03-20T00:00:00.000Z');
    });

    test('should record failure when update throws, and continue processing', async () => {
      const v1 = makeVerification({ createdOn: '2025-03-10T00:00:00.000Z' });
      const v2 = makeVerification({ createdOn: '2025-03-15T00:00:00.000Z' });

      vi.spyOn(MockMongoRepository.prototype, 'updateVerificationTaskDate')
        .mockRejectedValueOnce(new Error('write failed'))
        .mockResolvedValueOnce(undefined);

      const result = await BackfillTrusteeVerificationTaskDateUseCase.backfillTaskDates(context, [
        v1,
        v2,
      ]);

      expect(result.data?.length).toBe(2);
      expect(result.data?.[0].success).toBe(false);
      expect(result.data?.[0].error).toContain('write failed');
      expect(result.data?.[1].success).toBe(true);
    });
  });

  describe('processBackfillPage', () => {
    test('should return ok with successCount and nextCursor when more pages remain', async () => {
      const v1 = makeVerification();
      const v2 = makeVerification();

      vi.spyOn(MockMongoRepository.prototype, 'findVerificationsMissingTaskDate').mockResolvedValue(
        [v1, v2],
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateVerificationTaskDate').mockResolvedValue();

      const result = await BackfillTrusteeVerificationTaskDateUseCase.processBackfillPage(
        context,
        null,
        1,
      );

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.successCount).toBe(1);
      expect(result.nextCursor).not.toBeNull();
    });

    test('should return ok with failedResults when individual updates fail', async () => {
      const v1 = makeVerification();
      const v2 = makeVerification();

      vi.spyOn(MockMongoRepository.prototype, 'findVerificationsMissingTaskDate').mockResolvedValue(
        [v1, v2],
      );
      vi.spyOn(MockMongoRepository.prototype, 'updateVerificationTaskDate')
        .mockRejectedValueOnce(new Error('write failed'))
        .mockResolvedValueOnce(undefined);

      const result = await BackfillTrusteeVerificationTaskDateUseCase.processBackfillPage(
        context,
        null,
        10,
      );

      expect(result.status).toBe('ok');
      if (result.status !== 'ok') return;
      expect(result.successCount).toBe(1);
      expect(result.processedCount).toBe(2);
      expect(result.failedResults).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    test('should return empty when no verifications need backfill', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findVerificationsMissingTaskDate').mockResolvedValue(
        [],
      );

      const result = await BackfillTrusteeVerificationTaskDateUseCase.processBackfillPage(
        context,
        null,
        100,
      );

      expect(result.status).toBe('empty');
    });

    test('should return error when getPageNeedingBackfill fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findVerificationsMissingTaskDate').mockRejectedValue(
        new Error('DB error'),
      );

      const result = await BackfillTrusteeVerificationTaskDateUseCase.processBackfillPage(
        context,
        null,
        100,
      );

      expect(result.status).toBe('error');
    });
  });
});
