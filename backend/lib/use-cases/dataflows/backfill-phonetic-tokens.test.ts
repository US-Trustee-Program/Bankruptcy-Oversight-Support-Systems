import { describe, test, expect, vi, beforeAll, afterEach } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import BackfillPhoneticTokens from './backfill-phonetic-tokens';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { generateSearchTokens } from '../../adapters/utils/phonetic-helper';
import { NotFoundError } from '../../common-errors/not-found-error';
import { PhoneticBackfillState } from '../gateways.types';

describe('BackfillPhoneticTokens use case', () => {
  let context: ApplicationContext;

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateTokenUpdates', () => {
    test('should generate tokens for debtor name', () => {
      const bCase = {
        _id: 'case-id-1',
        caseId: '123-45-67890',
        debtor: { name: 'John Smith' },
      };

      const updates = BackfillPhoneticTokens.generateTokenUpdates(bCase);

      expect(updates['debtor.phoneticTokens']).toBeDefined();
      expect(updates['debtor.phoneticTokens'].length).toBeGreaterThan(0);
      expect(updates['jointDebtor.phoneticTokens']).toBeUndefined();
    });

    test('should generate tokens for joint debtor name', () => {
      const bCase = {
        _id: 'case-id-1',
        caseId: '123-45-67890',
        jointDebtor: { name: 'Jane Doe' },
      };

      const updates = BackfillPhoneticTokens.generateTokenUpdates(bCase);

      expect(updates['debtor.phoneticTokens']).toBeUndefined();
      expect(updates['jointDebtor.phoneticTokens']).toBeDefined();
      expect(updates['jointDebtor.phoneticTokens'].length).toBeGreaterThan(0);
    });

    test('should generate tokens for both debtor and joint debtor', () => {
      const bCase = {
        _id: 'case-id-1',
        caseId: '123-45-67890',
        debtor: { name: 'John Smith' },
        jointDebtor: { name: 'Jane Smith' },
      };

      const updates = BackfillPhoneticTokens.generateTokenUpdates(bCase);

      expect(updates['debtor.phoneticTokens']).toBeDefined();
      expect(updates['jointDebtor.phoneticTokens']).toBeDefined();
    });

    test('should return empty object when no names exist', () => {
      const bCase = {
        _id: 'case-id-1',
        caseId: '123-45-67890',
      };

      const updates = BackfillPhoneticTokens.generateTokenUpdates(bCase);

      expect(Object.keys(updates).length).toBe(0);
    });

    test('should match output of generateSearchTokens', () => {
      const name = 'John Smith';
      const bCase = {
        _id: 'case-id-1',
        caseId: '123-45-67890',
        debtor: { name },
      };

      const updates = BackfillPhoneticTokens.generateTokenUpdates(bCase);
      const expectedTokens = generateSearchTokens(name);

      expect(updates['debtor.phoneticTokens']).toEqual(expectedTokens);
    });
  });

  describe('backfillTokensForCases', () => {
    test('should update cases with phonetic tokens', async () => {
      const updateManyByQuerySpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateManyByQuery')
        .mockResolvedValue({ modifiedCount: 1, matchedCount: 1 });

      const cases = [
        { _id: 'id-1', caseId: '123-45-67890', debtor: { name: 'John Smith' } },
        { _id: 'id-2', caseId: '123-45-67891', debtor: { name: 'Jane Doe' } },
      ];

      const result = await BackfillPhoneticTokens.backfillTokensForCases(context, cases);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBe(2);
      expect(result.data?.every((r) => r.success)).toBe(true);
      expect(updateManyByQuerySpy).toHaveBeenCalledTimes(2);
    });

    test('should handle cases with no names gracefully', async () => {
      const updateManyByQuerySpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateManyByQuery')
        .mockResolvedValue({ modifiedCount: 1, matchedCount: 1 });

      const cases = [{ _id: 'id-1', caseId: '123-45-67890' }];

      const result = await BackfillPhoneticTokens.backfillTokensForCases(context, cases);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].success).toBe(true);
      // Should not call updateManyByQuery when there are no token updates
      expect(updateManyByQuerySpy).not.toHaveBeenCalled();
    });

    test('should record failure when update throws error', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'updateManyByQuery').mockRejectedValue(
        new Error('Database error'),
      );

      const cases = [{ _id: 'id-1', caseId: '123-45-67890', debtor: { name: 'John Smith' } }];

      const result = await BackfillPhoneticTokens.backfillTokensForCases(context, cases);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].success).toBe(false);
      expect(result.data?.[0].error).toBe('Database error');
    });
  });

  describe('getPageOfCasesNeedingBackfillByCursor', () => {
    test('should return cases that need backfill with cursor info', async () => {
      const caseNeedingBackfill = MockData.getSyncedCase({
        override: { caseId: '123-45-67890', debtor: { name: 'John Smith' }, _id: 'case-id-1' },
      });
      const mockCases = [caseNeedingBackfill];

      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue(mockCases);

      const result = await BackfillPhoneticTokens.getPageOfCasesNeedingBackfillByCursor(
        context,
        null,
        100,
      );

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.cases.length).toBe(1);
      expect(result.data?.cases[0].caseId).toBe('123-45-67890');
      expect(result.data?.lastId).toBe('case-id-1');
      expect(result.data?.hasMore).toBe(false);
    });

    test('should detect hasMore when more results than limit', async () => {
      const case1 = MockData.getSyncedCase({
        override: { caseId: '123-45-67890', _id: 'case-id-1' },
      });
      const case2 = MockData.getSyncedCase({
        override: { caseId: '123-45-67891', _id: 'case-id-2' },
      });
      // Return limit + 1 results to indicate hasMore
      const mockCases = [case1, case2];

      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue(mockCases);

      const result = await BackfillPhoneticTokens.getPageOfCasesNeedingBackfillByCursor(
        context,
        null,
        1, // limit of 1
      );

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.cases.length).toBe(1); // Only returns limit, not limit+1
      expect(result.data?.hasMore).toBe(true);
      expect(result.data?.lastId).toBe('case-id-1');
    });

    test('should return empty result when no cases found', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([]);

      const result = await BackfillPhoneticTokens.getPageOfCasesNeedingBackfillByCursor(
        context,
        'some-cursor',
        100,
      );

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.cases.length).toBe(0);
      expect(result.data?.hasMore).toBe(false);
      expect(result.data?.lastId).toBeNull();
    });

    test('should return error when findByCursor fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockRejectedValue(
        new Error('Database error'),
      );

      const result = await BackfillPhoneticTokens.getPageOfCasesNeedingBackfillByCursor(
        context,
        null,
        100,
      );

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('readBackfillState', () => {
    test('should return existing state', async () => {
      const existingState: PhoneticBackfillState = {
        id: 'state-id-1',
        documentType: 'PHONETIC_BACKFILL_STATE',
        lastId: 'cursor-123',
        processedCount: 500,
        startedAt: '2024-01-01T00:00:00.000Z',
        lastUpdatedAt: '2024-01-01T01:00:00.000Z',
        status: 'IN_PROGRESS',
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingState);

      const result = await BackfillPhoneticTokens.readBackfillState(context);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.lastId).toBe('cursor-123');
      expect(result.data?.processedCount).toBe(500);
      expect(result.data?.status).toBe('IN_PROGRESS');
    });

    test('should return null when no state exists (first run)', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new NotFoundError('TEST', { message: 'Not found' }),
      );

      const result = await BackfillPhoneticTokens.readBackfillState(context);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeNull();
    });

    test('should return error on unexpected failure', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new Error('Database connection failed'),
      );

      const result = await BackfillPhoneticTokens.readBackfillState(context);

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('updateBackfillState', () => {
    test('should create new state when none exists', async () => {
      const readSpy = vi
        .spyOn(MockMongoRepository.prototype, 'read')
        .mockRejectedValue(new NotFoundError('TEST', { message: 'Not found' }));

      const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue({
        id: 'new-state-id',
        documentType: 'PHONETIC_BACKFILL_STATE',
        lastId: 'cursor-123',
        processedCount: 100,
        startedAt: expect.any(String),
        lastUpdatedAt: expect.any(String),
        status: 'IN_PROGRESS',
      } as PhoneticBackfillState);

      const result = await BackfillPhoneticTokens.updateBackfillState(context, {
        lastId: 'cursor-123',
        processedCount: 100,
        status: 'IN_PROGRESS',
      });

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(readSpy).toHaveBeenCalled();
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'PHONETIC_BACKFILL_STATE',
          lastId: 'cursor-123',
          processedCount: 100,
          status: 'IN_PROGRESS',
        }),
      );
    });

    test('should preserve startedAt when updating existing state', async () => {
      const existingState: PhoneticBackfillState = {
        id: 'existing-id',
        documentType: 'PHONETIC_BACKFILL_STATE',
        lastId: 'old-cursor',
        processedCount: 50,
        startedAt: '2024-01-01T00:00:00.000Z',
        lastUpdatedAt: '2024-01-01T00:30:00.000Z',
        status: 'IN_PROGRESS',
      };

      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(existingState);

      const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue({
        ...existingState,
        lastId: 'new-cursor',
        processedCount: 150,
        lastUpdatedAt: expect.any(String),
      } as PhoneticBackfillState);

      const result = await BackfillPhoneticTokens.updateBackfillState(context, {
        lastId: 'new-cursor',
        processedCount: 150,
        status: 'IN_PROGRESS',
      });

      expect(result.error).toBeUndefined();
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'existing-id',
          startedAt: '2024-01-01T00:00:00.000Z', // Should be preserved
          lastId: 'new-cursor',
          processedCount: 150,
        }),
      );
    });

    test('should return error when upsert fails', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new NotFoundError('TEST', { message: 'Not found' }),
      );
      vi.spyOn(MockMongoRepository.prototype, 'upsert').mockRejectedValue(
        new Error('Database error'),
      );

      const result = await BackfillPhoneticTokens.updateBackfillState(context, {
        lastId: 'cursor-123',
        processedCount: 100,
        status: 'IN_PROGRESS',
      });

      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });
});
